# GYM-Management-System

## Netlify env vars required

Configure these in Netlify Site Settings > Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OTP_HASH_SECRET` (recommended, used to SHA-256 hash OTP values before storing)
- `SMTP_HOST` (optional, defaults to `smtp.gmail.com`)
- `SMTP_PORT` (optional, defaults to `587`)
- `SMTP_SECURE` (`true` or `false`, optional)
- `SMTP_USER`
- `SMTP_PASS`

## Local Netlify dev

For `netlify dev`, create a local `.env` file in the project root (you can copy `.env.example`) and set all required variables there before starting dev server.
