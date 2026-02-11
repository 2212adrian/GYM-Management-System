const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const quickLoginSecret = process.env.QUICK_LOGIN_SECRET || serviceRoleKey;
const quickLoginHashSecret =
  process.env.QUICK_LOGIN_HASH_SECRET || quickLoginSecret || serviceRoleKey;
const quickLoginExpirySeconds = Number(
  process.env.QUICK_LOGIN_EXPIRES_SECONDS || 120,
);
const quickLoginRegenerateCooldownSeconds = Number(
  process.env.QUICK_LOGIN_REGENERATE_COOLDOWN_SECONDS || 30,
);

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

function hashGeo(value, type) {
  return hashWithSecret(String(value || 'unknown').trim().toLowerCase(), `${type}:`);
}

function deriveRequestSecret(requestId) {
  return crypto
    .createHmac('sha256', quickLoginSecret)
    .update(`quick-login:${requestId}`)
    .digest('hex');
}

function base64urlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

async function resolveGeo(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return {
      city: 'Localhost',
      region: 'Development',
      country: 'Local',
      countryCode: 'LC',
    };
  }

  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('GeoIP request failed');
    const data = await res.json();
    return {
      city: data?.city || 'Unknown city',
      region: data?.region || data?.region_code || 'Unknown region',
      country: data?.country || 'Unknown country',
      countryCode: data?.country_code || 'UN',
    };
  } catch (_) {
    return {
      city: 'Unknown city',
      region: 'Unknown region',
      country: 'Unknown country',
      countryCode: 'UN',
    };
  }
}

async function findLatestPendingByIdentity(supabase, requesterIpHash, requesterUserAgentHash) {
  const { data, error } = await supabase
    .from('quick_login_requests')
    .select('request_id, request_secret_hash, created_at, expires_at')
    .eq('requester_ip', requesterIpHash)
    .eq('requester_user_agent', requesterUserAgentHash)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findLatestAnyByIdentity(supabase, requesterIpHash, requesterUserAgentHash) {
  const { data, error } = await supabase
    .from('quick_login_requests')
    .select('created_at')
    .eq('requester_ip', requesterIpHash)
    .eq('requester_user_agent', requesterUserAgentHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function expireIfPendingAndExpired(supabase, row, nowIso) {
  if (!row?.request_id) return;
  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expiresAtMs || expiresAtMs > Date.now()) return;

  await supabase
    .from('quick_login_requests')
    .update({ status: 'expired', updated_at: nowIso })
    .eq('request_id', row.request_id)
    .eq('status', 'pending');
}

async function deletePendingByIdentity(supabase, requesterIpHash, requesterUserAgentHash) {
  const { error } = await supabase
    .from('quick_login_requests')
    .delete()
    .eq('requester_ip', requesterIpHash)
    .eq('requester_user_agent', requesterUserAgentHash)
    .eq('status', 'pending');

  if (error) throw error;
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

    let payload = {};
    try {
      payload = parseBody(event.body);
    } catch (_) {
      return json(400, { error: 'Invalid request body JSON' });
    }

    const forceNew = Boolean(payload.forceNew);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const expiresAt = new Date(nowMs + quickLoginExpirySeconds * 1000);

    const requesterIpRaw = getClientIp(event);
    const requesterUserAgentRaw = getUserAgent(event);
    const requesterIpHash = hashIp(requesterIpRaw);
    const requesterUserAgentHash = hashUserAgent(requesterUserAgentRaw);

    const latestPendingRequest = await findLatestPendingByIdentity(
      supabase,
      requesterIpHash,
      requesterUserAgentHash,
    );

    await expireIfPendingAndExpired(supabase, latestPendingRequest, nowIso);
    let bypassCreateCooldown = false;

    if (latestPendingRequest && !forceNew) {
      const pendingExpiresAtMs = latestPendingRequest.expires_at
        ? new Date(latestPendingRequest.expires_at).getTime()
        : 0;
      const isStillValid = pendingExpiresAtMs > nowMs;

      const reusableRequestSecret = deriveRequestSecret(
        latestPendingRequest.request_id,
      );
      const canRestoreExisting =
        hashSecret(reusableRequestSecret) ===
        latestPendingRequest.request_secret_hash;

      if (isStillValid && canRestoreExisting) {
        const createdAtMs = latestPendingRequest.created_at
          ? new Date(latestPendingRequest.created_at).getTime()
          : nowMs;
        const regenerateRemainingSeconds = Math.max(
          0,
          Math.ceil(
            (createdAtMs + quickLoginRegenerateCooldownSeconds * 1000 - nowMs) /
              1000,
          ),
        );

        const qrPayload = base64urlEncode(
          JSON.stringify({
            requestId: latestPendingRequest.request_id,
            requestSecret: reusableRequestSecret,
            v: 1,
          }),
        );

        return json(200, {
          requestId: latestPendingRequest.request_id,
          requestSecret: reusableRequestSecret,
          expiresAt: latestPendingRequest.expires_at,
          regenerateCooldownSeconds: quickLoginRegenerateCooldownSeconds,
          regenerateRemainingSeconds,
          reusedPending: true,
          qrValue: `WOLFQL1.${qrPayload}`,
          location: {
            ip: 'Protected by SHA-256',
            city: 'Protected by SHA-256',
            region: 'Protected by SHA-256',
            country: 'Protected by SHA-256',
          },
        });
      }

      // Older rows may have random request secrets that cannot be regenerated
      // after refresh. Allow immediate replacement once.
      bypassCreateCooldown = true;
    }

    const latestAnyRequest = await findLatestAnyByIdentity(
      supabase,
      requesterIpHash,
      requesterUserAgentHash,
    );

    if (latestAnyRequest?.created_at) {
      const latestCreatedAtMs = new Date(latestAnyRequest.created_at).getTime();
      const remainingCooldown = Math.max(
        0,
        Math.ceil(
          (latestCreatedAtMs +
            quickLoginRegenerateCooldownSeconds * 1000 -
            nowMs) /
            1000,
        ),
      );

      if (remainingCooldown > 0 && !bypassCreateCooldown) {
        return json(429, {
          error: `Wait ${remainingCooldown}s before regenerating QR`,
          remainingTime: remainingCooldown,
          regenerateCooldownSeconds: quickLoginRegenerateCooldownSeconds,
        });
      }
    }

    await deletePendingByIdentity(supabase, requesterIpHash, requesterUserAgentHash);

    const requestId = crypto.randomUUID().replace(/-/g, '');
    const requestSecret = deriveRequestSecret(requestId);
    const requestSecretHash = hashSecret(requestSecret);

    const location = await resolveGeo(requesterIpRaw);

    const { error } = await supabase.from('quick_login_requests').insert({
      request_id: requestId,
      request_secret_hash: requestSecretHash,
      status: 'pending',
      requester_ip: requesterIpHash,
      requester_city: hashGeo(location.city, 'city'),
      requester_region: hashGeo(location.region, 'region'),
      requester_country: hashGeo(location.country, 'country'),
      requester_country_code: hashGeo(location.countryCode, 'country_code'),
      requester_user_agent: requesterUserAgentHash,
      updated_at: nowIso,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      return json(500, { error: error.message });
    }

    const qrPayload = base64urlEncode(
      JSON.stringify({
        requestId,
        requestSecret,
        v: 1,
      }),
    );

    return json(200, {
      requestId,
      requestSecret,
      expiresAt: expiresAt.toISOString(),
      regenerateCooldownSeconds: quickLoginRegenerateCooldownSeconds,
      regenerateRemainingSeconds: quickLoginRegenerateCooldownSeconds,
      reusedPending: false,
      qrValue: `WOLFQL1.${qrPayload}`,
      location: {
        ip: 'Protected by SHA-256',
        city: 'Protected by SHA-256',
        region: 'Protected by SHA-256',
        country: 'Protected by SHA-256',
      },
    });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected server error' });
  }
};
