const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    // Get client IP address
    const clientIP = event.headers['x-forwarded-for'] ||
                     event.headers['x-real-ip'] ||
                     event.requestContext?.identity?.sourceIp ||
                     'unknown';

    // Update or insert cooldown record
    const { error } = await supabase
      .from('otp_cooldowns')
      .upsert({
        ip_address: clientIP,
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
        ip: clientIP
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