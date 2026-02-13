-- Equipments table used by EquipmentManager

CREATE TABLE IF NOT EXISTS public.equipments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equipment_code text UNIQUE,
  name text NOT NULL,
  condition text NOT NULL DEFAULT 'GOOD',
  status text NOT NULL DEFAULT 'ACTIVE',
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipments_status
ON public.equipments (status);

CREATE INDEX IF NOT EXISTS idx_equipments_created_at
ON public.equipments (created_at DESC);
