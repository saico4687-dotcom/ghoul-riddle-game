ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS payment_phone text;
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS email text;