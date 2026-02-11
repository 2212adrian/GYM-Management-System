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
    const clientIP = event.headers['x-forwarded-for'] ||
                     event.headers['x-real-ip'] ||
                     event.requestContext?.identity?.sourceIp ||
                     'unknown';
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
