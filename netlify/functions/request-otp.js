import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(userId, otp, secret) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${otp}:${secret}`)
    .digest('hex');
}

export async function handler(event, context) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing Supabase server env vars' }) };
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing SMTP env vars' }) };
    }

    const otpHashSecret = process.env.OTP_HASH_SECRET || serviceRoleKey;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const { email } = JSON.parse(event.body);
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email is required" }) };
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    }

    const otp = generateOtp();
    const otpHash = hashOtp(user.id, otp, otpHashSecret);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('password_reset_otp').insert([
      { user_id: user.id, otp_code: otpHash, expires_at: expiresAt }
    ]);

    await transporter.sendMail({
      from: '"Your App" <no-reply@example.com>',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp} (expires in 5 minutes)`
    });

    return { statusCode: 200, body: JSON.stringify({ message: "OTP sent to email!" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
