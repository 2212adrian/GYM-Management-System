const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const quickLoginSecret = process.env.QUICK_LOGIN_SECRET || serviceRoleKey;
const quickLoginHashSecret =
  process.env.QUICK_LOGIN_HASH_SECRET || quickLoginSecret || serviceRoleKey;

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

function looksLikeSha256Hex(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || '').trim());
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

function deriveRequestSecret(requestId) {
  return crypto
    .createHmac('sha256', quickLoginSecret)
    .update(`quick-login:${requestId}`)
    .digest('hex');
}

function isValidRequestCredentials(row, requestId, requestSecret) {
  const stored = String(row?.request_secret_hash || '');
  if (!stored) return false;

  const providedHash = hashSecret(requestSecret);
  if (stored === providedHash) return true;

  const deterministicHash = hashSecret(deriveRequestSecret(requestId));
  return stored === deterministicHash;
}

function normalizePreviewContext(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    ip: String(source.ip || '').trim().slice(0, 128),
    city: String(source.city || '').trim().slice(0, 128),
    region: String(source.region || '').trim().slice(0, 128),
    country: String(source.country || '').trim().slice(0, 128),
  };
}

function signPreviewContext(requestId, requestSecretHash, previewContext) {
  const canonical = normalizePreviewContext(previewContext);
  return crypto
    .createHmac('sha256', quickLoginSecret)
    .update(
      `${requestId}|${requestSecretHash}|${JSON.stringify(canonical)}`,
    )
    .digest('hex');
}

function verifyPreviewContext(
  requestId,
  requestSecretHash,
  previewContext,
  previewSig,
) {
  const sig = String(previewSig || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
  const expected = signPreviewContext(requestId, requestSecretHash, previewContext);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
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

    const requestId = String(payload.requestId || '').trim();
    const requestSecret = String(payload.requestSecret || '').trim();
    const consume = Boolean(payload.consume);
    const previewContextInput = normalizePreviewContext(payload.previewContext);
    const previewSigInput = String(payload.previewSig || '').trim();

    if (!requestId) {
      return json(400, { error: 'requestId is required' });
    }

    const { data: row, error: rowError } = await supabase
      .from('quick_login_requests')
      .select(
        `
          request_id,
          created_at,
          request_secret_hash,
          status,
          expires_at,
          requester_ip,
          requester_user_agent,
          requester_city,
          requester_region,
          requester_country,
          requester_country_code,
          approved_by_auth_user_id,
          approved_by_email,
          approved_access_token,
          approved_refresh_token
        `,
      )
      .eq('request_id', requestId)
      .maybeSingle();

    if (rowError) return json(500, { error: rowError.message });
    if (!row) return json(404, { error: 'Quick-login request not found' });

    // Only the requester device (consume=true) must present the request secret.
    // Scanner preview checks (consume=false) use requestId + signed preview context.
    if (consume) {
      if (!requestSecret) {
        return json(400, { error: 'requestSecret is required for consume' });
      }
      const isCredentialValid = isValidRequestCredentials(
        row,
        requestId,
        requestSecret,
      );
      if (!isCredentialValid) {
        return json(401, { error: 'Invalid quick-login credentials' });
      }
    }

    const hasVerifiedPreview =
      !consume &&
      verifyPreviewContext(
        requestId,
        row.request_secret_hash,
        previewContextInput,
        previewSigInput,
      );

    const displayLocation = hasVerifiedPreview
      ? previewContextInput
      : {
          ip: 'Protected by SHA-256',
          city: 'Protected by SHA-256',
          region: 'Protected by SHA-256',
          country: 'Protected by SHA-256',
          countryCode: 'Protected by SHA-256',
        };

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
      const consumerIpHash = hashIp(consumerIp);
      const consumerUserAgentHash = hashUserAgent(consumerUserAgent);

      const requesterIpStored = String(row.requester_ip || '').trim();
      const requesterUserAgentStored = String(row.requester_user_agent || '').trim();

      const requesterIpIsHashed = looksLikeSha256Hex(requesterIpStored);
      const requesterUaIsHashed = looksLikeSha256Hex(requesterUserAgentStored);

      if (requesterIpIsHashed || requesterUaIsHashed) {
        if (requesterIpIsHashed && requesterIpStored !== consumerIpHash) {
          return json(403, { error: 'Quick-login consumer IP mismatch' });
        }

        if (
          requesterUaIsHashed &&
          requesterUserAgentStored !== consumerUserAgentHash
        ) {
          return json(403, { error: 'Quick-login consumer device mismatch' });
        }
      } else {
        // Legacy plaintext fallback support
        if (
          !isLocalOrUnknownIp(requesterIpStored) &&
          !isLocalOrUnknownIp(consumerIp) &&
          requesterIpStored !== consumerIp
        ) {
          return json(403, { error: 'Quick-login consumer IP mismatch' });
        }

        if (
          requesterUserAgentStored &&
          consumerUserAgent &&
          requesterUserAgentStored !== consumerUserAgent
        ) {
          return json(403, { error: 'Quick-login consumer device mismatch' });
        }
      }

      const accessToken = row.approved_access_token;
      const refreshToken = row.approved_refresh_token;
      const consumedAtIso = new Date().toISOString();

      if (!accessToken || !refreshToken) {
        return json(410, { status: 'consumed', error: 'Approval already consumed' });
      }

      await supabase
        .from('quick_login_requests')
        .update({
          status: 'consumed',
          updated_at: consumedAtIso,
          consumed_at: consumedAtIso,
          approved_access_token: null,
          approved_refresh_token: null,
        })
        .eq('request_id', requestId)
        .eq('status', 'approved');

      const { error: auditError } = await supabase.from('audit_log').insert({
        table_name: 'quick_login_requests',
        operation: 'CONSUME',
        record_id: row.request_id,
        changed_by: row.approved_by_auth_user_id || null,
        change_payload: {
          status_from: 'approved',
          status_to: 'consumed',
          consumed_at: consumedAtIso,
          created_at: row.created_at || null,
          requester_ip_hash: row.requester_ip || null,
          requester_city_hash: row.requester_city || null,
          requester_region_hash: row.requester_region || null,
          requester_country_hash: row.requester_country || null,
          approved_by_email: row.approved_by_email || null,
          consumed_by_ip_hash: consumerIpHash,
          consumed_by_user_agent_hash: consumerUserAgentHash,
        },
      });

      if (auditError) {
        console.warn('Quick-login consume audit insert failed:', auditError.message);
      }

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
      location: displayLocation,
      previewVerified: hasVerifiedPreview,
      approvedByEmail: row.approved_by_email || null,
    });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected server error' });
  }
};
