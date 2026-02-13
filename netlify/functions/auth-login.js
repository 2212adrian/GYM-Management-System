const { createClient } = require('@supabase/supabase-js');
const { withErrorCode } = require('./error-codes');

function json(statusCode, body, extraHeaders = {}) {
  const payload = withErrorCode(statusCode, body);
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return json(500, { error: 'Missing Supabase env vars' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );

  const { email, password } = JSON.parse(event.body);

  // 1. Log in via Supabase Admin (Server-side)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return json(401, { error: error.message });

  const token = data.session.access_token;
  const refreshToken = data.session.refresh_token;

  // 2. Set the HTTP-only Cookie
  // Max-Age 31536000 = 1 year (Forever Logged In)
  const cookieHeader = [
    `sb-access-token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
    `sb-refresh-token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`
  ];

  return json(
    200,
    { user: data.user },
    {
      'Set-Cookie': cookieHeader, // Multi-value headers
    },
  );
};
