const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const ipHashSecret =
  process.env.IP_HASH_SECRET ||
  process.env.OTP_HASH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  supabaseKey;

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

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing Supabase env vars' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP address
    const clientIP = getClientIp(event);
    const clientIpHash = hashIp(clientIP, ipHashSecret);

    // Update or insert cooldown record
    const { error } = await supabase
      .from('otp_cooldowns')
      .upsert({
        ip_address: clientIpHash,
        last_sent_at: new Date().toISOString()
      }, {
        onConflict: 'ip_address'
      });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Cooldown updated',
        ipHash: clientIpHash
      })
    };

  } catch (error) {
    console.error('Cooldown update error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to update cooldown',
        success: false
      })
    };
  }
};
