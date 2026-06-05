ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS gift_packaging_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gift_packaging_price numeric(10,2) NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS gift_message_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gift_message_price numeric(10,2) NOT NULL DEFAULT 1;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gift_packaging boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gift_packaging_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_message text,
  ADD COLUMN IF NOT EXISTS gift_message_fee numeric(10,2) NOT NULL DEFAULT 0;