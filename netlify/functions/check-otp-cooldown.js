const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

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

  if (event.httpMethod !== 'GET') {
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

    // Check if there's an active cooldown
    const { data, error } = await supabase
      .from('otp_cooldowns')
      .select('last_sent_at')
      .eq('ip_address', clientIP)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    const COOLDOWN_SECONDS = 60; // 1 minute cooldown
    let canSend = true;
    let remainingTime = 0;

    if (data) {
      const lastSent = new Date(data.last_sent_at);
      const now = new Date();
      const timeDiff = (now - lastSent) / 1000; // seconds

      if (timeDiff < COOLDOWN_SECONDS) {
        canSend = false;
        remainingTime = Math.ceil(COOLDOWN_SECONDS - timeDiff);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        canSend,
        remainingTime,
        ip: clientIP
      })
    };

  } catch (error) {
    console.error('Cooldown check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to check cooldown',
        canSend: true,
        remainingTime: 0
      })
    };
  }
};
