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
    const accessToken = String(payload.accessToken || '').trim();
    const refreshToken = String(payload.refreshToken || '').trim();

    if (!requestId || !requestSecret || !accessToken || !refreshToken) {
      return json(400, {
        error: 'requestId, requestSecret, accessToken, and refreshToken are required',
      });
    }

    const { data: row, error: rowError } = await supabase
      .from('quick_login_requests')
      .select('request_id, request_secret_hash, status, expires_at')
      .eq('request_id', requestId)
      .maybeSingle();

    if (rowError) return json(500, { error: rowError.message });
    if (!row) return json(404, { error: 'Quick-login request not found' });

    if (row.request_secret_hash !== hashSecret(requestSecret)) {
      return json(401, { error: 'Invalid quick-login credentials' });
    }

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
        approved_by_ip: getClientIp(event),
        approved_by_user_agent: getUserAgent(event),
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
