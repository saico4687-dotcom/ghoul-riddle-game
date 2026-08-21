-- ============================================================
-- منتج ثالث في شاشة العرض: "إلغاء إعلانات الفاصل" — 30 جنيه.
-- بيوقف بس إعلان الفاصل (Interstitial) اللي بيظهر كل 5 ألغاز،
-- ومش بيأثر على البانر ولا شاشة العرض نفسها. مختلف عن no_ads
-- (50 جنيه) اللي بتلغي كل حاجة (بانر + فاصل) وبتشمل تلقائيًا
-- reward_unlock و no_interstitial مع بعض.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purchased_no_interstitial boolean NOT NULL DEFAULT false;

-- شيل الشرط القديم اللي بيسمح بمنتجين بس وضيف الثالث بدله.
ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_product_check;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_product_check
  CHECK (product IN ('reward_unlock', 'no_ads', 'no_interstitial'));
