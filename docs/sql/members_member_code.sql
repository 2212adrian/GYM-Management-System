-- Members code migration
-- Adds member_code in ME-XXXX format and auto-generates it on insert.

ALTER TABLE IF EXISTS public.members
ADD COLUMN IF NOT EXISTS member_code text;

-- Optional SKU alias (mirrors member_code)
ALTER TABLE IF EXISTS public.members
ADD COLUMN IF NOT EXISTS sku text GENERATED ALWAYS AS (member_code) STORED;

-- Normalize any existing values and backfill missing codes.
UPDATE public.members
SET member_code = UPPER(TRIM(member_code))
WHERE member_code IS NOT NULL;

WITH needs_code AS (
  SELECT
    member_id,
    row_number() OVER (ORDER BY created_at NULLS LAST, member_id) AS rn
  FROM public.members
  WHERE member_code IS NULL OR BTRIM(member_code) = ''
)
UPDATE public.members AS m
SET member_code = 'ME-' || LPAD(needs_code.rn::text, 4, '0')
FROM needs_code
WHERE m.member_id = needs_code.member_id;

CREATE SEQUENCE IF NOT EXISTS public.member_code_seq START WITH 1;

WITH max_code AS (
  SELECT MAX((REGEXP_REPLACE(member_code, '[^0-9]', '', 'g'))::bigint) AS value
  FROM public.members
  WHERE member_code ~ '^ME-[0-9]+$'
)
SELECT setval(
  'public.member_code_seq',
  COALESCE((SELECT value FROM max_code), 1),
  COALESCE((SELECT value IS NOT NULL FROM max_code), false)
);

CREATE OR REPLACE FUNCTION public.assign_member_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.member_code IS NULL OR BTRIM(NEW.member_code) = '' THEN
    NEW.member_code := 'ME-' || LPAD(nextval('public.member_code_seq')::text, 4, '0');
  ELSE
    NEW.member_code := UPPER(BTRIM(NEW.member_code));
    IF NEW.member_code NOT LIKE 'ME-%' THEN
      NEW.member_code := 'ME-' || NEW.member_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_member_code ON public.members;
CREATE TRIGGER trg_assign_member_code
BEFORE INSERT OR UPDATE OF member_code ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.assign_member_code();

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_member_code_unique
ON public.members (member_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_sku_unique
ON public.members (sku);
