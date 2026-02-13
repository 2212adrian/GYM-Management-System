-- Members membership lifecycle fields
-- Required for:
-- - MemberManager: change plan, renew, deactivate
-- - ID Maker dynamic status/plan rendering

ALTER TABLE IF EXISTS public.members
ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS membership_plan text NOT NULL DEFAULT 'STANDARD MEMBERSHIP',
ADD COLUMN IF NOT EXISTS membership_expires_at date,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.members
SET
  membership_status = COALESCE(NULLIF(BTRIM(membership_status), ''), 'ACTIVE'),
  membership_plan = COALESCE(NULLIF(BTRIM(membership_plan), ''), 'STANDARD MEMBERSHIP'),
  is_active = COALESCE(is_active, true);

CREATE INDEX IF NOT EXISTS idx_members_membership_status
ON public.members (membership_status);

CREATE INDEX IF NOT EXISTS idx_members_membership_expiry
ON public.members (membership_expires_at);
