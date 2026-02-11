-- password_reset_otp RLS: allow read + insert only (anon/authenticated), deny update/delete
-- Run this in Supabase SQL Editor.

-- 1) Ensure table RLS is enabled
alter table public.password_reset_otp enable row level security;

-- 2) Privileges: read + insert only
grant select, insert on table public.password_reset_otp to anon, authenticated;
revoke update, delete on table public.password_reset_otp from anon, authenticated;

-- 3) Drop old policies if they exist
drop policy if exists password_reset_otp_select_all on public.password_reset_otp;
drop policy if exists password_reset_otp_insert_all on public.password_reset_otp;
drop policy if exists password_reset_otp_update_all on public.password_reset_otp;
drop policy if exists password_reset_otp_delete_all on public.password_reset_otp;

-- 4) Allow select for everyone (anon + authenticated)
create policy password_reset_otp_select_all
  on public.password_reset_otp
  for select
  to anon, authenticated
  using (true);

-- 5) Allow insert for everyone (anon + authenticated)
create policy password_reset_otp_insert_all
  on public.password_reset_otp
  for insert
  to anon, authenticated
  with check (true);

-- No update/delete policies created: writes are blocked for these operations.
