// netlify/functions/verify-otp.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const serviceRoleKey = 'sb_secret_OdFToFL4d7I_O-XlbbGEew_FNH5sZQd';
const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function handler(event, context) {
  try {
    const { email, otp, newPassword } = JSON.parse(event.body);
    if (!email || !otp || !newPassword) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email, OTP, and new password required" }) };
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    const user = users.find(u => u.email === email);
    if (!user) return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };

    const { data: otpRecord } = await supabase
      .from('password_reset_otp')
      .select('*')
      .eq('user_id', user.id)
      .eq('otp_code', otp)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (!otpRecord) return { statusCode: 400, body: JSON.stringify({ error: "Invalid or expired OTP" }) };

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    if (updateError) return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };

    await supabase.from('password_reset_otp').delete().eq('id', otpRecord.id);

    return { statusCode: 200, body: JSON.stringify({ message: "Password reset successfully!" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}