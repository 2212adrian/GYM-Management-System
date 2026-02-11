-- Keep only one product hash column to avoid redundant schema.
-- This script adds `integrity_hash` and removes legacy per-field hash columns.

ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS integrity_hash text;

ALTER TABLE IF EXISTS public.products
DROP COLUMN IF EXISTS sku_hash,
DROP COLUMN IF EXISTS name_hash,
DROP COLUMN IF EXISTS brand_hash,
DROP COLUMN IF EXISTS description_hash;

CREATE INDEX IF NOT EXISTS idx_products_integrity_hash
ON public.products (integrity_hash);
