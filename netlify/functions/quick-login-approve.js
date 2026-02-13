const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const quickLoginSecret = process.env.QUICK_LOGIN_SECRET || serviceRoleKey;
const quickLoginHashSecret =
  process.env.QUICK_LOGIN_HASH_SECRET || quickLoginSecret || serviceRoleKey;
const quickLoginQrSecret =
  process.env.QUICK_LOGIN_QR_SECRET ||
  process.env.QUICK_LOGIN_ENCRYPTION_SECRET ||
  quickLoginHashSecret ||
  quickLoginSecret ||
  serviceRoleKey;
const quickLoginQrPrefix = 'WOLFQL2.';
const quickLoginQrEncryptionKey = crypto
  .createHash('sha256')
  .update(String(quickLoginQrSecret || ''))
  .digest();

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

function hashWithSecret(value, prefix = '') {
  return crypto
    .createHash('sha256')
    .update(`${prefix}${value}:${quickLoginHashSecret}`)
    .digest('hex');
}

function hashIp(ip) {
  return hashWithSecret(ip, 'ip:');
}

function hashUserAgent(userAgent) {
  return hashWithSecret(userAgent, 'ua:');
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

function getUserAgent(event) {
  return (
    event.headers?.['user-agent'] || event.headers?.['User-Agent'] || 'unknown'
  );
}

function decryptQrPayload(qrToken) {
  const raw = String(qrToken || '').trim();
  if (!raw) {
    throw new Error('Missing quick-login QR token');
  }

  const encoded = raw.startsWith(quickLoginQrPrefix)
    ? raw.slice(quickLoginQrPrefix.length)
    : raw;
  if (!encoded) {
    throw new Error('Malformed quick-login QR token');
  }

  const packed = Buffer.from(encoded, 'base64url');
  if (packed.length < 29) {
    throw new Error('Malformed quick-login QR token');
  }

  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    quickLoginQrEncryptionKey,
    iv,
  );
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext);
}

function extractRequestIdFromQrToken(qrToken) {
  const payload = decryptQrPayload(qrToken);
  const requestId = String(payload?.requestId || payload?.r || '').trim();
  if (!requestId) throw new Error('QR token missing requestId');
  return requestId;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

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

    const qrToken = String(payload.qrToken || '').trim();
    let requestId = String(payload.requestId || '').trim();
    const accessToken = String(payload.accessToken || '').trim();
    const refreshToken = String(payload.refreshToken || '').trim();

    if (qrToken) {
      try {
        const requestIdFromQr = extractRequestIdFromQrToken(qrToken);
        if (requestId && requestId !== requestIdFromQr) {
          return json(400, { error: 'requestId mismatch with qrToken payload' });
        }
        requestId = requestIdFromQr;
      } catch (err) {
        return json(400, { error: err.message || 'Invalid quick-login QR token' });
      }
    }

    if (!requestId || !accessToken || !refreshToken) {
      return json(400, {
        error: 'requestId (or qrToken), accessToken, and refreshToken are required',
      });
    }

    const { data: row, error: rowError } = await supabase
      .from('quick_login_requests')
      .select('request_id, request_secret_hash, status, expires_at')
      .eq('request_id', requestId)
      .maybeSingle();

    if (rowError) return json(500, { error: rowError.message });
    if (!row) return json(404, { error: 'Quick-login request not found' });

    if (row.status !== 'pending') {
      return json(409, { error: `Quick-login request is ${row.status}` });
    }

    const now = Date.now();
    const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (expiresAtMs > 0 && expiresAtMs <= now) {
      await supabase
        .from('quick_login_requests')
        .update({ status: 'expired' })
        .eq('request_id', requestId)
        .eq('status', 'pending');

      return json(410, { error: 'Quick-login request expired' });
    }

    const { data: approverData, error: approverError } =
      await supabase.auth.getUser(accessToken);

    if (approverError || !approverData?.user) {
      return json(401, { error: 'Approver session is invalid or expired' });
    }

    const approverUser = approverData.user;
    if (approverUser.user_metadata?.role !== 'admin') {
      return json(403, { error: 'Only admin accounts can approve quick-login' });
    }

    const { error: updateError } = await supabase
      .from('quick_login_requests')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        approved_by_auth_user_id: approverUser.id,
        approved_by_email: approverUser.email || null,
        approved_access_token: accessToken,
        approved_refresh_token: refreshToken,
        approved_by_ip: hashIp(getClientIp(event)),
        approved_by_user_agent: hashUserAgent(getUserAgent(event)),
      })
      .eq('request_id', requestId)
      .eq('status', 'pending');

    if (updateError) return json(500, { error: updateError.message });

    return json(200, {
      status: 'approved',
      approvedByEmail: approverUser.email || null,
    });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected server error' });
  }
};
