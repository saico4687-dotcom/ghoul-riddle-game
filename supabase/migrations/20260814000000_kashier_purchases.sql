-- ============================================================
-- نظام المشتريات داخل التطبيق (كاشير Kashier):
--   - منتج "reward_unlock" (30 جنيه): يفتح استخدام أداتَي المساعدة
--     (حذف إجابتين + إضافة دقيقة) بلا حدود وفي كل الألغاز، بدون
--     الحاجة لمشاهدة إعلان مكافأة.
--   - منتج "no_ads" (50 جنيه): يوقف كل الإعلانات (بانر + فاصل)
--     من أول التطبيق لآخره، ويشمل أيضًا فتح أداتَي المساعدة زي
--     منتج reward_unlock (الباقة الأشمل تتضمن الأصغر).
--
-- الحقيقة الوحيدة لحالة الشراء تعيش على السيرفر (عمودين على
-- profiles) ولا تُكتب أبدًا من الكلاينت مباشرة — تُكتب فقط من
-- Edge Function كاشير-ويبهوك (service role) بعد التحقق من توقيع
-- كاشير على الإشعار. أي حساب جديد يبدأ بالقيمتين false ولازم
-- يشتري بنفسه.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purchased_reward_unlock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchased_no_ads boolean NOT NULL DEFAULT false;

-- سجل كل عملية شراء (معلّقة/ناجحة/فاشلة) — orderId فريد بنولّده
-- إحنا (create-kashier-payment) ونمرره لكاشير كـ merchantOrderId،
-- وده اللي بيرجعلنا في الويبهوك عشان نعرف نربط الدفعة بصاحبها
-- وبمنتجها من غير ما نصدّق أي حاجة تانية جاية من الكلاينت.
CREATE TABLE IF NOT EXISTS public.purchases (
  order_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('reward_unlock', 'no_ads')),
  amount_egp numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  kashier_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON public.purchases(user_id);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- المستخدم يقدر يشوف مشترياته هو بس (لعرض حالة "جاري التحقق من
-- الدفع" في الواجهة مثلًا). الكتابة/التعديل مقصورة على service role
-- (Edge Functions) — مفيش أي INSERT/UPDATE policy للمستخدم العادي.
CREATE POLICY "Users can view their own purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
