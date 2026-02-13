-- Goal target RLS policy setup
-- Run this if Goal Center shows:
-- "new row violates row-level security policy for table goal_target"

ALTER TABLE IF EXISTS public.goal_target
ENABLE ROW LEVEL SECURITY;

-- Reset old policies safely
DROP POLICY IF EXISTS goal_target_select_authenticated ON public.goal_target;
DROP POLICY IF EXISTS goal_target_insert_authenticated ON public.goal_target;
DROP POLICY IF EXISTS goal_target_update_authenticated ON public.goal_target;
DROP POLICY IF EXISTS goal_target_delete_authenticated ON public.goal_target;

-- Allow logged-in dashboard users
CREATE POLICY goal_target_select_authenticated
ON public.goal_target
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY goal_target_insert_authenticated
ON public.goal_target
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY goal_target_update_authenticated
ON public.goal_target
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY goal_target_delete_authenticated
ON public.goal_target
FOR DELETE
TO authenticated
USING (true);

