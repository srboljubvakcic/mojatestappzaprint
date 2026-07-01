ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS support_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS support_phone text NOT NULL DEFAULT '+387 60 000 0000';