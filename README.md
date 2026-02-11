# GYM-Management-System

## Netlify env vars required

Configure these in Netlify Site Settings > Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OTP_HASH_SECRET` (recommended, used to SHA-256 hash OTP values before storing)
- `IP_HASH_SECRET` (recommended, used to SHA-256 hash `otp_cooldowns.ip_address`)
- `OTP_MAX_ATTEMPTS` (optional, defaults to `3`)
- `OTP_COOLDOWN_SECONDS` (optional, defaults to `30`)
- `OTP_ATTEMPT_WINDOW_SECONDS` (optional, defaults to `60`)
- `OTP_RESEND_COOLDOWN_SECONDS` (optional, defaults to `60`)
- `PRODUCT_HASH_SECRET` (recommended, used to SHA-256 hash product integrity payloads in `add-product` function)
- `QUICK_LOGIN_SECRET` (recommended, used to hash one-time QR request secrets)
- `QUICK_LOGIN_EXPIRES_SECONDS` (optional, defaults to `120`)
- `SMTP_HOST` (optional, defaults to `smtp.gmail.com`)
- `SMTP_PORT` (optional, defaults to `587`)
- `SMTP_SECURE` (`true` or `false`, optional)
- `SMTP_USER`
- `SMTP_PASS`

## Local Netlify dev

For `netlify dev`, create a local `.env` file in the project root (you can copy `.env.example`) and set all required variables there before starting dev server.

## Optional DB hardening

To keep product hash storage minimal (single `integrity_hash` column only), run:

- `docs/sql/products_hash_columns.sql`

To enable OTP anti-spam cooldown persistence (3 attempts then 30s lock), run:

- `docs/sql/otp_cooldowns_rate_limit.sql`

To enable QR quick-login request storage and locking, run:

- `docs/sql/quick_login_requests.sql`
