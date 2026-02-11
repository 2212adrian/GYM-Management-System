const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Supabase env vars' }),
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  );

  const { email, password } = JSON.parse(event.body);

  // 1. Log in via Supabase Admin (Server-side)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { statusCode: 401, body: JSON.stringify({ error: error.message }) };

  const token = data.session.access_token;
  const refreshToken = data.session.refresh_token;

  // 2. Set the HTTP-only Cookie
  // Max-Age 31536000 = 1 year (Forever Logged In)
  const cookieHeader = [
    `sb-access-token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
    `sb-refresh-token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`
  ];

  return {
    statusCode: 200,
    headers: {
      "Set-Cookie": cookieHeader, // Multi-value headers
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user: data.user })
  };
};
