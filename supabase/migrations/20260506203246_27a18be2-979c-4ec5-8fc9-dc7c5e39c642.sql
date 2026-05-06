
ALTER TABLE public.competition_scores
  DROP COLUMN IF EXISTS paid,
  DROP COLUMN IF EXISTS payment_phone,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_proof_url,
  DROP COLUMN IF EXISTS payment_date,
  DROP COLUMN IF EXISTS payment_time,
  DROP COLUMN IF EXISTS extracted_text,
  DROP COLUMN IF EXISTS transaction_number,
  DROP COLUMN IF EXISTS address;

DROP POLICY IF EXISTS "Users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read payment proofs" ON storage.objects;
