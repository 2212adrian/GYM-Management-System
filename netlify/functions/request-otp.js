import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ipHashSecret =
  process.env.IP_HASH_SECRET ||
  process.env.OTP_HASH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 3);
const OTP_COOLDOWN_SECONDS = Number(process.env.OTP_COOLDOWN_SECONDS || 30);
const OTP_ATTEMPT_WINDOW_SECONDS = Number(
  process.env.OTP_ATTEMPT_WINDOW_SECONDS || 60,
);
const OTP_RESEND_COOLDOWN_SECONDS = Number(
  process.env.OTP_RESEND_COOLDOWN_SECONDS || 60,
);

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  const xForwardedFor =
    event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (xForwardedFor) return normalizeIp(xForwardedFor);

  return normalizeIp(
    event.headers?.['x-real-ip'] ||
    event.requestContext?.identity?.sourceIp ||
    'unknown',
  );
}

function hashIp(ip, secret) {
  return crypto.createHash('sha256').update(`${ip}:${secret}`).digest('hex');
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

function hashOtp(userId, otp, secret) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${otp}:${secret}`)
    .digest('hex');
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing Supabase server env vars' }),
      };
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing SMTP env vars' }),
      };
    }

    const otpHashSecret = process.env.OTP_HASH_SECRET || serviceRoleKey;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const clientIpHash = hashIp(getClientIp(event), ipHashSecret);
    const now = new Date();

    // --- OTP RATE LIMIT: 3 attempts then 30s cooldown (server-side enforced) ---
    // Fallback: if new columns are missing, use legacy resend cooldown by `last_sent_at`.
    let cooldownRow = null;
    let hasAdvancedCooldownColumns = true;

    const cooldownRead = await supabase
      .from('otp_cooldowns')
      .select('ip_address, attempts, last_sent_at, window_started_at, cooldown_until')
      .eq('ip_address', clientIpHash)
      .maybeSingle();

    if (cooldownRead.error) {
      if (!isMissingCooldownColumnsError(cooldownRead.error)) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: cooldownRead.error.message }),
        };
      }

      hasAdvancedCooldownColumns = false;
      const legacyRead = await supabase
        .from('otp_cooldowns')
        .select('ip_address, last_sent_at')
        .eq('ip_address', clientIpHash)
        .maybeSingle();

      if (legacyRead.error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: legacyRead.error.message }),
        };
      }
      cooldownRow = legacyRead.data;
    } else {
      cooldownRow = cooldownRead.data;
    }

    const nowMs = now.getTime();
    const cooldownUntilMs =
      hasAdvancedCooldownColumns && cooldownRow?.cooldown_until
      ? new Date(cooldownRow.cooldown_until).getTime()
      : null;
    const abuseRemainingTime =
      cooldownUntilMs && cooldownUntilMs > nowMs
        ? Math.max(1, Math.ceil((cooldownUntilMs - nowMs) / 1000))
        : 0;

    const lastSentAtMs = cooldownRow?.last_sent_at
      ? new Date(cooldownRow.last_sent_at).getTime()
      : null;
    const resendRemainingTime =
      lastSentAtMs && lastSentAtMs + OTP_RESEND_COOLDOWN_SECONDS * 1000 > nowMs
        ? Math.max(
            1,
            Math.ceil(
              (lastSentAtMs + OTP_RESEND_COOLDOWN_SECONDS * 1000 - nowMs) / 1000,
            ),
          )
        : 0;

    const activeRemainingTime = Math.max(
      abuseRemainingTime,
      resendRemainingTime,
    );

    let existingAttempts = 0;
    let existingWindowStart = null;
    let windowAgeSec = Infinity;
    let resetWindow = true;
    let nextAttempts = 0;
    let cooldownStartsNow = false;

    if (hasAdvancedCooldownColumns) {
      existingAttempts = Number(cooldownRow?.attempts || 0);
      existingWindowStart = cooldownRow?.window_started_at
        ? new Date(cooldownRow.window_started_at)
        : null;

      windowAgeSec = existingWindowStart
        ? (now.getTime() - existingWindowStart.getTime()) / 1000
        : Infinity;

      resetWindow =
        !existingWindowStart || windowAgeSec >= OTP_ATTEMPT_WINDOW_SECONDS;
      nextAttempts = resetWindow ? 1 : existingAttempts + 1;
      cooldownStartsNow = nextAttempts >= OTP_MAX_ATTEMPTS;
    }

    if (activeRemainingTime > 0) {
      if (hasAdvancedCooldownColumns) {
        const blockedCooldownUntil = cooldownStartsNow
          ? new Date(now.getTime() + OTP_COOLDOWN_SECONDS * 1000).toISOString()
          : cooldownRow?.cooldown_until || null;

        const { error: blockedWriteError } = await supabase
          .from('otp_cooldowns')
          .upsert(
            {
              ip_address: clientIpHash,
              attempts: cooldownStartsNow ? 0 : nextAttempts,
              last_sent_at: cooldownRow?.last_sent_at || now.toISOString(),
              window_started_at: resetWindow
                ? now.toISOString()
                : cooldownRow?.window_started_at || now.toISOString(),
              cooldown_until: blockedCooldownUntil,
            },
            { onConflict: 'ip_address' },
          );

        if (blockedWriteError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: blockedWriteError.message }),
          };
        }
      }

      const antiSpamTriggered = hasAdvancedCooldownColumns && cooldownStartsNow;
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: antiSpamTriggered
            ? 'OTP cooldown active'
            : resendRemainingTime >= abuseRemainingTime
              ? 'Resend cooldown active'
              : 'OTP cooldown active',
          remainingTime: antiSpamTriggered
            ? OTP_COOLDOWN_SECONDS
            : activeRemainingTime,
          maxAttempts: OTP_MAX_ATTEMPTS,
        }),
      };
    }

    let cooldownWriteError = null;

    if (hasAdvancedCooldownColumns) {
      const cooldownUntil = cooldownStartsNow
        ? new Date(now.getTime() + OTP_COOLDOWN_SECONDS * 1000).toISOString()
        : null;

      const { error } = await supabase.from('otp_cooldowns').upsert(
        {
          ip_address: clientIpHash,
          attempts: cooldownStartsNow ? 0 : nextAttempts,
          last_sent_at: now.toISOString(),
          window_started_at: resetWindow
            ? now.toISOString()
            : cooldownRow.window_started_at,
          cooldown_until: cooldownUntil,
        },
        { onConflict: 'ip_address' },
      );
      cooldownWriteError = error;
    } else {
      const { error } = await supabase.from('otp_cooldowns').upsert(
        {
          ip_address: clientIpHash,
          last_sent_at: now.toISOString(),
        },
        { onConflict: 'ip_address' },
      );
      cooldownWriteError = error;
    }

    if (cooldownWriteError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: cooldownWriteError.message }),
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    let payload;
    try {
      payload =
        typeof event.body === 'string' && event.body.length > 0
          ? JSON.parse(event.body)
          : event.body || {};
    } catch (_) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body JSON' }),
      };
    }

    const email = String(payload.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'User not found',
          remainingTime: Math.max(
            OTP_RESEND_COOLDOWN_SECONDS,
            cooldownStartsNow ? OTP_COOLDOWN_SECONDS : 0,
          ),
          maxAttempts: OTP_MAX_ATTEMPTS,
        }),
      };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(user.id, otp, otpHashSecret);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { data: insertedOtp, error: otpInsertError } = await supabase
      .from('password_reset_otp')
      .insert([{ user_id: user.id, otp_code: otpHash, expires_at: expiresAt }])
      .select('id, otp_code')
      .single();

    if (otpInsertError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: otpInsertError.message }),
      };
    }

    const storedOtp = insertedOtp?.otp_code || '';
    const isSha256Hex = /^[a-f0-9]{64}$/i.test(storedOtp);
    if (!isSha256Hex) {
      // Safety guard: do not keep plaintext OTPs if DB trigger/rule overrides the value.
      await supabase.from('password_reset_otp').delete().eq('id', insertedOtp.id);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Unsafe OTP storage detected (expected SHA-256 hash)',
        }),
      };
    }

    await transporter.sendMail({
      from: '"Your App" <no-reply@example.com>',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp} (expires in 5 minutes)`
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'OTP sent to email!',
        cooldownStarted: true,
        remainingTime: Math.max(
          OTP_RESEND_COOLDOWN_SECONDS,
          cooldownStartsNow ? OTP_COOLDOWN_SECONDS : 0,
        ),
        attemptsLeft: hasAdvancedCooldownColumns
          ? cooldownStartsNow
            ? 0
            : Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts)
          : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
