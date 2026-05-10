CREATE TABLE public.answer_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  riddle_index integer NOT NULL,
  elapsed_ms integer NOT NULL,
  game_mode text NOT NULL DEFAULT 'competition',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.answer_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own answer times"
  ON public.answer_times FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own answer times"
  ON public.answer_times FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all answer times"
  ON public.answer_times FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_answer_times_created ON public.answer_times (created_at DESC);
CREATE INDEX idx_answer_times_elapsed ON public.answer_times (elapsed_ms ASC);