-- Audit log table for system history and backend audit inserts

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id text,
  changed_by text,
  change_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Compatibility patch for older schemas that used `changed_at` and may not
-- have `created_at`/`change_payload` yet.
ALTER TABLE IF EXISTS public.audit_log
ADD COLUMN IF NOT EXISTS change_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS created_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'changed_at'
  ) THEN
    UPDATE public.audit_log
    SET created_at = COALESCE(created_at, changed_at, now())
    WHERE created_at IS NULL;
  ELSE
    UPDATE public.audit_log
    SET created_at = COALESCE(created_at, now())
    WHERE created_at IS NULL;
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.audit_log
ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE IF EXISTS public.audit_log
ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation
ON public.audit_log (table_name, operation);
