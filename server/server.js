import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Serve static files from the project root (one level up from /server)
app.use(express.static(path.join(__dirname, '..')));

// ✅ Redirect root / to index.html (your main app)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---------------- Supabase Config ----------------
const supabaseUrl = 'https://xhahdzyjhwutgqfcrzfc.supabase.co';
const serviceRoleKey = 'sb_secret_OdFToFL4d7I_O-XlbbGEew_FNH5sZQd';
const supabase = createClient(supabaseUrl, serviceRoleKey);

// ---------------- Email Config ----------------
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'adrianangeles2212@gmail.com',
    pass: 'xksp onuk ncii uyue' // Gmail App Password
  }
});

// Helper: Generate 6-digit OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------- Route: Request OTP ----------------
app.post('/api/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });

    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: "User not found" });

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

    res.json({ message: "OTP sent to email!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Route: Verify OTP ----------------
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP, and new password required" });
    }

    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });

    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { data: otpRecord } = await supabase
      .from('password_reset_otp')
      .select('*')
      .eq('user_id', user.id)
      .eq('otp_code', otp)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (!otpRecord) return res.status(400).json({ error: "Invalid or expired OTP" });

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    if (updateError) return res.status(500).json({ error: updateError.message });

    await supabase.from('password_reset_otp').delete().eq('id', otpRecord.id);
    //await supabase.auth.admin.invalidateUserSessions(user.id);

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Start Server ----------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});