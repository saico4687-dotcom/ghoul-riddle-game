ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_total_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_time_bonus integer NOT NULL DEFAULT 0;