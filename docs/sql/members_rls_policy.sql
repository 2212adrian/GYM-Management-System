-- Members RLS policy setup
-- Use this when members data is blocked by RLS (no rows shown in UI).

ALTER TABLE IF EXISTS public.members
ENABLE ROW LEVEL SECURITY;

-- Reset old policies safely
DROP POLICY IF EXISTS members_select_authenticated ON public.members;
DROP POLICY IF EXISTS members_insert_authenticated ON public.members;
DROP POLICY IF EXISTS members_update_authenticated ON public.members;
DROP POLICY IF EXISTS members_delete_authenticated ON public.members;

-- Allow logged-in users used by the dashboard client
CREATE POLICY members_select_authenticated
ON public.members
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY members_insert_authenticated
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY members_update_authenticated
ON public.members
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY members_delete_authenticated
ON public.members
FOR DELETE
TO authenticated
USING (true);

