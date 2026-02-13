-- Feedback entries RLS policy setup
-- Run this if staff cannot submit feedback and you see:
-- "new row violates row-level security policy for table feedback_entries"

ALTER TABLE IF EXISTS public.feedback_entries
ENABLE ROW LEVEL SECURITY;

-- Reset old policies safely
DROP POLICY IF EXISTS feedback_entries_select_role_access ON public.feedback_entries;
DROP POLICY IF EXISTS feedback_entries_insert_staff_only ON public.feedback_entries;
DROP POLICY IF EXISTS feedback_entries_update_admin_mark_read ON public.feedback_entries;
DROP POLICY IF EXISTS feedback_entries_update_staff_unread_only ON public.feedback_entries;
DROP POLICY IF EXISTS feedback_entries_delete_staff_unread_only ON public.feedback_entries;
DROP POLICY IF EXISTS feedback_entries_delete_expired_read_role_access ON public.feedback_entries;

-- Shared role checks (email fallback supports fixed role mapping)
-- Admin emails:
-- - adrianangeles2212@gmail.com
-- - ktorrazo123@gmail.com
-- Staff email:
-- - adrianangeles2213@gmail.com

CREATE POLICY feedback_entries_select_role_access
ON public.feedback_entries
FOR SELECT
TO authenticated
USING (
  COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'staff')
  OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') IN (
    'adrianangeles2212@gmail.com',
    'ktorrazo123@gmail.com',
    'adrianangeles2213@gmail.com'
  )
);

CREATE POLICY feedback_entries_insert_staff_only
ON public.feedback_entries
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'staff'
  OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') = 'adrianangeles2213@gmail.com'
);

-- Admin: can only manage read/unread workflow
CREATE POLICY feedback_entries_update_admin_mark_read
ON public.feedback_entries
FOR UPDATE
TO authenticated
USING (
  COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') IN (
    'adrianangeles2212@gmail.com',
    'ktorrazo123@gmail.com'
  )
)
WITH CHECK (
  COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') IN (
    'adrianangeles2212@gmail.com',
    'ktorrazo123@gmail.com'
  )
);

-- Staff: can edit own operational content while unread (read = locked)
CREATE POLICY feedback_entries_update_staff_unread_only
ON public.feedback_entries
FOR UPDATE
TO authenticated
USING (
  is_read = false
  AND (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'staff'
    OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') = 'adrianangeles2213@gmail.com'
  )
)
WITH CHECK (
  is_read = false
  AND (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'staff'
    OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') = 'adrianangeles2213@gmail.com'
  )
);

-- Staff: delete only while unread
CREATE POLICY feedback_entries_delete_staff_unread_only
ON public.feedback_entries
FOR DELETE
TO authenticated
USING (
  is_read = false
  AND (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'staff'
    OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') = 'adrianangeles2213@gmail.com'
  )
);

-- System cleanup path: allow read entries older than 30 days to be auto-deleted
-- by any authorized admin/staff session.
CREATE POLICY feedback_entries_delete_expired_read_role_access
ON public.feedback_entries
FOR DELETE
TO authenticated
USING (
  is_read = true
  AND created_at <= (now() - interval '30 days')
  AND (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'staff')
    OR COALESCE(LOWER(auth.jwt() ->> 'email'), '') IN (
      'adrianangeles2212@gmail.com',
      'ktorrazo123@gmail.com',
      'adrianangeles2213@gmail.com'
    )
  )
);
