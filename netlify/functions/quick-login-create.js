const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const quickLoginSecret = process.env.QUICK_LOGIN_SECRET || serviceRoleKey;
const quickLoginExpirySeconds = Number(
  process.env.QUICK_LOGIN_EXPIRES_SECONDS || 120,
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

function hashSecret(secret) {
  return crypto
    .createHash('sha256')
    .update(`${secret}:${quickLoginSecret}`)
    .digest('hex');
}

function base64urlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

async function resolveGeo(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return {
      ip,
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
      ip,
      city: data?.city || 'Unknown city',
      region: data?.region || data?.region_code || 'Unknown region',
      country: data?.country || 'Unknown country',
      countryCode: data?.country_code || 'UN',
    };
  } catch (_) {
    return {
      ip,
      city: 'Unknown city',
      region: 'Unknown region',
      country: 'Unknown country',
      countryCode: 'UN',
    };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: 'Missing Supabase server env vars' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + quickLoginExpirySeconds * 1000);

    const requestId = crypto.randomUUID().replace(/-/g, '');
    const requestSecret = crypto.randomBytes(24).toString('hex');
    const requestSecretHash = hashSecret(requestSecret);
    const requesterIp = getClientIp(event);
    const location = await resolveGeo(requesterIp);

    const { error } = await supabase.from('quick_login_requests').insert({
      request_id: requestId,
      request_secret_hash: requestSecretHash,
      status: 'pending',
      requester_ip: requesterIp,
      requester_city: location.city,
      requester_region: location.region,
      requester_country: location.country,
      requester_country_code: location.countryCode,
      requester_user_agent:
        event.headers?.['user-agent'] || event.headers?.['User-Agent'] || null,
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
      qrValue: `WOLFQL1.${qrPayload}`,
      location: {
        ip: location.ip,
        city: location.city,
        region: location.region,
        country: location.country,
      },
    });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected server error' });
  }
};

