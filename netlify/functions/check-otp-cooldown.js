const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');
const { withErrorCode } = require('./error-codes');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const ipHashSecret =
  process.env.IP_HASH_SECRET ||
  process.env.OTP_HASH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  supabaseKey;

const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 3);
const OTP_COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS || 30);
const OTP_RESEND_COOLDOWN_SECONDS = Number(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || 60,
);

function hashIp(ip, secret) {
  return crypto.createHash('sha256').update(`${ip}:${secret}`).digest('hex');
}

function normalizeIp(rawIp) {
  let ip = String(rawIp || '')
    .split(',')[0]
    .trim();
  if (!ip) return 'unknown';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function getClientIp(event) {
  const reqHeaders = event.headers || {};
  const xForwardedFor =
    reqHeaders['x-forwarded-for'] || reqHeaders['X-Forwarded-For'];
  if (xForwardedFor) return normalizeIp(xForwardedFor);

  return normalizeIp(
    reqHeaders['x-real-ip'] ||
      event.requestContext?.identity?.sourceIp ||
      'unknown',
  );
}

function isMissingCooldownColumnsError(error) {
  const message = String(error?.message || '');
  return (
    error?.code === '42703' ||
    /column .* does not exist/i.test(message) ||
    message.includes('cooldown_until') ||
    message.includes('window_started_at') ||
    message.includes('attempts')
  );
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  function respond(statusCode, payload) {
    return {
      statusCode,
      headers,
      body: JSON.stringify(withErrorCode(statusCode, payload)),
    };
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return respond(405, { error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return respond(500, { error: 'Missing Supabase env vars' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP address
    const clientIP = getClientIp(event);
    const clientIpHash = hashIp(clientIP, ipHashSecret);

    // Check if there's an active cooldown. Fallback to legacy schema if new columns do not exist yet.
    let data = null;
    let hasAdvancedCooldownColumns = true;

    const advancedRead = await supabase
      .from('otp_cooldowns')
      .select('attempts, cooldown_until, last_sent_at, window_started_at')
      .eq('ip_address', clientIpHash)
      .maybeSingle();

    if (advancedRead.error) {
      if (!isMissingCooldownColumnsError(advancedRead.error)) {
        throw advancedRead.error;
      }

      hasAdvancedCooldownColumns = false;
      const legacyRead = await supabase
        .from('otp_cooldowns')
        .select('last_sent_at')
        .eq('ip_address', clientIpHash)
        .maybeSingle();

      if (legacyRead.error) throw legacyRead.error;
      data = legacyRead.data;
    } else {
      data = advancedRead.data;
    }

    let remainingTime = 0;
    const nowMs = Date.now();

    if (hasAdvancedCooldownColumns && data?.cooldown_until) {
      const cooldownUntilMs = new Date(data.cooldown_until).getTime();
      if (cooldownUntilMs > nowMs) {
        remainingTime = Math.max(
          1,
          Math.ceil((cooldownUntilMs - nowMs) / 1000),
        );
      }
    }

    if (data?.last_sent_at) {
      const lastSentAtMs = new Date(data.last_sent_at).getTime();
      const resendRemaining =
        lastSentAtMs + OTP_RESEND_COOLDOWN_SECONDS * 1000 > nowMs
          ? Math.max(
              1,
              Math.ceil(
                (lastSentAtMs + OTP_RESEND_COOLDOWN_SECONDS * 1000 - nowMs) /
                  1000,
              ),
            )
          : 0;
      remainingTime = Math.max(remainingTime, resendRemaining);
    }

    const canSend = remainingTime <= 0;

    return respond(200, {
      canSend,
      remainingTime,
      ipHash: clientIpHash,
      maxAttempts: OTP_MAX_ATTEMPTS,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      cooldownSchema: hasAdvancedCooldownColumns ? 'advanced' : 'legacy',
    });

  } catch (error) {
    console.error('Cooldown check error:', error);
    const details =
      process.env.NODE_ENV === 'production'
        ? undefined
        : String(error?.message || error);
    return respond(500, {
      error: 'Failed to check cooldown',
      details,
      canSend: true,
      remainingTime: 0,
    });
  }
};
