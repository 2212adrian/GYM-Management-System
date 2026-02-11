const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const quickLoginSecret = process.env.QUICK_LOGIN_SECRET || serviceRoleKey;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    if (!body.trim()) return {};
    return JSON.parse(body);
  }
  return body;
}

function hashSecret(secret) {
  return crypto
    .createHash('sha256')
    .update(`${secret}:${quickLoginSecret}`)
    .digest('hex');
}

function getClientIp(event) {
  const xForwardedFor =
    event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (xForwardedFor) return String(xForwardedFor).split(',')[0].trim();

  return (
    event.headers?.['x-real-ip'] ||
    event.requestContext?.identity?.sourceIp ||
    'unknown'
  );
}

function getUserAgent(event) {
  return (
    event.headers?.['user-agent'] || event.headers?.['User-Agent'] || 'unknown'
  );
}

function isLocalOrUnknownIp(ip) {
  return (
    !ip ||
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost'
  );
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: 'Missing Supabase server env vars' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let payload = {};
    try {
      payload = parseBody(event.body);
    } catch (_) {
      return json(400, { error: 'Invalid request body JSON' });
    }

    const requestId = String(payload.requestId || '').trim();
    const requestSecret = String(payload.requestSecret || '').trim();
    const consume = Boolean(payload.consume);

    if (!requestId || !requestSecret) {
      return json(400, { error: 'requestId and requestSecret are required' });
    }

    const { data: row, error: rowError } = await supabase
      .from('quick_login_requests')
      .select(
        `
          request_id,
          request_secret_hash,
          status,
          expires_at,
          requester_ip,
          requester_user_agent,
          requester_city,
          requester_region,
          requester_country,
          requester_country_code,
          approved_by_email,
          approved_access_token,
          approved_refresh_token
        `,
      )
      .eq('request_id', requestId)
      .maybeSingle();

    if (rowError) return json(500, { error: rowError.message });
    if (!row) return json(404, { error: 'Quick-login request not found' });

    if (row.request_secret_hash !== hashSecret(requestSecret)) {
      return json(401, { error: 'Invalid quick-login credentials' });
    }

    const now = Date.now();
    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    const isExpired = expiresAtMs > 0 && expiresAtMs <= now;

    if (isExpired && row.status === 'pending') {
      await supabase
        .from('quick_login_requests')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId)
        .eq('status', 'pending');

      return json(410, {
        status: 'expired',
        error: 'Quick-login request expired',
      });
    }

    if (row.status === 'approved' && consume) {
      const consumerIp = getClientIp(event);
      const consumerUserAgent = getUserAgent(event);
      const requesterIp = String(row.requester_ip || '').trim();
      const requesterUserAgent = String(row.requester_user_agent || '').trim();

      if (
        !isLocalOrUnknownIp(requesterIp) &&
        !isLocalOrUnknownIp(consumerIp) &&
        requesterIp !== consumerIp
      ) {
        return json(403, { error: 'Quick-login consumer IP mismatch' });
      }

      if (
        requesterUserAgent &&
        consumerUserAgent &&
        requesterUserAgent !== consumerUserAgent
      ) {
        return json(403, { error: 'Quick-login consumer device mismatch' });
      }

      const accessToken = row.approved_access_token;
      const refreshToken = row.approved_refresh_token;

      if (!accessToken || !refreshToken) {
        return json(410, { status: 'consumed', error: 'Approval already consumed' });
      }

      await supabase
        .from('quick_login_requests')
        .update({
          status: 'consumed',
          updated_at: new Date().toISOString(),
          consumed_at: new Date().toISOString(),
          approved_access_token: null,
          approved_refresh_token: null,
        })
        .eq('request_id', requestId)
        .eq('status', 'approved');

      return json(200, {
        status: 'approved',
        accessToken,
        refreshToken,
        approvedByEmail: row.approved_by_email || null,
      });
    }

    return json(200, {
      status: row.status,
      expiresAt: row.expires_at,
      remainingSeconds:
        expiresAtMs > now ? Math.max(1, Math.ceil((expiresAtMs - now) / 1000)) : 0,
      location: {
        ip: row.requester_ip || null,
        city: row.requester_city || null,
        region: row.requester_region || null,
        country: row.requester_country || null,
        countryCode: row.requester_country_code || null,
      },
      approvedByEmail: row.approved_by_email || null,
    });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected server error' });
  }
};
