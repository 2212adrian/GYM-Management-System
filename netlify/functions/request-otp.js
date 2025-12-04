// netlify/functions/request-otp.js
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const serviceRoleKey = 'sb_secret_OdFToFL4d7I_O-XlbbGEew_FNH5sZQd';
const supabase = createClient(supabaseUrl, serviceRoleKey);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'adrianangeles2212@gmail.com',
    pass: 'xksp onuk ncii uyue' // Gmail App Password
  }
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function handler(event, context) {
  try {
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email is required" }) };
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    const user = users.find(u => u.email === email);
    if (!user) return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await supabase.from('password_reset_otp').insert([
      { user_id: user.id, otp_code: otp, expires_at: expiresAt }
    ]);

    await transporter.sendMail({
      from: '"Your App" <no-reply@example.com>',
      to: email,
      subject: 'Your OTP Code',
      text: `Hello!\n\nYour OTP code is: ${otp}\nIt expires in 5 minutes.\n\nIf you did not request this, ignore this email.`
    });

    return { statusCode: 200, body: JSON.stringify({ message: "OTP sent to email!" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}