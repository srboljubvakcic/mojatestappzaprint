
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS volume_discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS volume_discount_threshold integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS volume_discount_percent numeric NOT NULL DEFAULT 10;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS volume_discount_fee numeric NOT NULL DEFAULT 0;
