import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import errorCodes from './error-codes.js';

const { withErrorCode } = errorCodes;

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

  function respond(statusCode, payload) {
    return {
      statusCode,
      headers,
      body: JSON.stringify(withErrorCode(statusCode, payload)),
    };
  }

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return respond(405, { error: 'Method not allowed' });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return respond(500, { error: 'Missing Supabase server env vars' });
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
      return respond(400, { error: 'Invalid request body JSON' });
    }

    const email = String(payload.email || '')
      .trim()
      .toLowerCase();
    const otp = String(payload.otp || '').trim();
    const newPassword = String(payload.newPassword || '');
    if (!email || !otp || !newPassword) {
      return respond(400, { error: 'Email, OTP, and new password required' });
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return respond(500, { error: error.message });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return respond(404, { error: 'User not found' });
    }

    const otpHash = hashOtp(user.id, otp, otpHashSecret);

    const { data: otpRecord, error: otpLookupError } = await supabase
      .from('password_reset_otp')
      .select('id, expires_at')
      .eq('user_id', user.id)
      // Temporary compatibility for legacy plaintext OTP rows.
      .or(`otp_code.eq.${otpHash},otp_code.eq.${otp}`)
      .order('expires_at', { ascending: false })
      .maybeSingle();

    if (otpLookupError) {
      return respond(500, { error: otpLookupError.message });
    }

    if (!otpRecord) {
      return respond(400, {
        error: 'Invalid OTP',
        errorKey: 'KEY_INVALID',
      });
    }

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      return respond(410, {
        error: 'OTP has expired',
        errorKey: 'KEY_EXPIRED',
      });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    if (updateError) {
      return respond(500, { error: updateError.message });
    }

    // Invalidate the used OTP and clear any leftover OTP rows for the same user.
    const { error: deleteOtpError } = await supabase
      .from('password_reset_otp')
      .delete()
      .eq('user_id', user.id);
    if (deleteOtpError) {
      return respond(500, { error: deleteOtpError.message });
    }

    return respond(200, { message: 'Password reset successfully!' });
  } catch (err) {
    return respond(500, { error: err.message });
  }
}
