import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function hashOtp(userId, otp, secret) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${otp}:${secret}`)
    .digest('hex');
}

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing Supabase server env vars' }),
      };
    }

    const otpHashSecret = process.env.OTP_HASH_SECRET || serviceRoleKey;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let payload;
    try {
      payload =
        typeof event.body === 'string' && event.body.length > 0
          ? JSON.parse(event.body)
          : event.body || {};
    } catch (_) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body JSON' }),
      };
    }

    const email = String(payload.email || '')
      .trim()
      .toLowerCase();
    const otp = String(payload.otp || '').trim();
    const newPassword = String(payload.newPassword || '');
    if (!email || !otp || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email, OTP, and new password required' }),
      };
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    const otpHash = hashOtp(user.id, otp, otpHashSecret);

    const { data: otpRecord } = await supabase
      .from('password_reset_otp')
      .select('*')
      .eq('user_id', user.id)
      // Temporary compatibility for legacy plaintext OTP rows.
      .or(`otp_code.eq.${otpHash},otp_code.eq.${otp}`)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!otpRecord) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired OTP' }),
      };
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    if (updateError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: updateError.message }),
      };
    }

    // Invalidate the used OTP and clear any leftover OTP rows for the same user.
    const { error: deleteOtpError } = await supabase
      .from('password_reset_otp')
      .delete()
      .eq('user_id', user.id);
    if (deleteOtpError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: deleteOtpError.message }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Password reset successfully!' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
