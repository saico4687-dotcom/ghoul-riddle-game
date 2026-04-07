
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS payment_proof_url text;
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS payment_date text;
ALTER TABLE public.competition_scores ADD COLUMN IF NOT EXISTS payment_time text;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload payment proofs
CREATE POLICY "Users can upload payment proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read of payment proofs
CREATE POLICY "Public read payment proofs" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');
