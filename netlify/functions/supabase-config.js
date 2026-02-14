const { withErrorCode } = require('./error-codes');

function json(statusCode, headers, payload) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(withErrorCode(statusCode, payload)),
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  const context = String(process.env.CONTEXT || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  const isProduction = context === 'production';
  const allowPublicConfig =
    !isProduction ||
    String(process.env.ALLOW_PUBLIC_SUPABASE_CONFIG || '')
      .trim()
      .toLowerCase() === 'true';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, headers, { error: 'Method not allowed' });
  }

  if (!allowPublicConfig) {
    return json(404, headers, { error: 'Not found' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY (or SUPABASE_KEY)');

    return json(500, headers, {
      error: 'Supabase runtime config is missing on server',
      missing,
    });
  }

  return json(200, headers, {
    supabaseUrl,
    supabaseAnonKey,
  });
};
