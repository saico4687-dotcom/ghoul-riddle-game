-- Drop overly permissive read policy
DROP POLICY IF EXISTS "Anyone can read quiz results" ON public.quiz_results;
DROP POLICY IF EXISTS "Anyone can insert quiz results" ON public.quiz_results;

-- Add user_id column to link results to authenticated users (nullable for legacy rows)
ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Only the owner can read their own quiz result
CREATE POLICY "Users can read own quiz results"
ON public.quiz_results
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all quiz results
CREATE POLICY "Admins can read all quiz results"
ON public.quiz_results
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert their own results
CREATE POLICY "Users can insert own quiz results"
ON public.quiz_results
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
