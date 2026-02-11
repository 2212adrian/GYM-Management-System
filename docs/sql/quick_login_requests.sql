-- One-time QR quick-login request storage
-- Run in Supabase SQL editor before using:
-- - netlify/functions/quick-login-create
-- - netlify/functions/quick-login-status
-- - netlify/functions/quick-login-approve

CREATE TABLE IF NOT EXISTS public.quick_login_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id text NOT NULL UNIQUE,
  request_secret_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'expired', 'consumed')
  ),
  requester_ip text,
  requester_city text,
  requester_region text,
  requester_country text,
  requester_country_code text,
  requester_user_agent text,
  approved_by_auth_user_id uuid,
  approved_by_email text,
  approved_by_ip text,
  approved_by_user_agent text,
  approved_access_token text,
  approved_refresh_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quick_login_requests_status_expires
ON public.quick_login_requests (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_quick_login_requests_created_at
ON public.quick_login_requests (created_at);

ALTER TABLE public.quick_login_requests ENABLE ROW LEVEL SECURITY;

-- No direct read/write from anon/authenticated roles.
REVOKE ALL ON TABLE public.quick_login_requests FROM anon;
REVOKE ALL ON TABLE public.quick_login_requests FROM authenticated;
