const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

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
