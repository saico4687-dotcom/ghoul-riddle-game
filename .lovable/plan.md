## الوضع الحالي

القاعدة موجودة بالفعل: جداول `profiles`, `friends`, `friend_requests`, `blocked_users`, `conversations`, `messages`, `notifications`, `reports`, `moderation_actions`, `user_presence`, `message_reactions` مع RLS ومحفزات (`handle_new_user`, `handle_friend_request_accepted`, `on_message_inserted`, `auto_moderate_on_report`, `notify_friend_request`, `get_or_create_conversation`, `search_users`). صفحات `src/pages/chat/*` موجودة كهيكل بسيط (~1139 سطر إجمالاً) لكنها ليست جاهزة للإنتاج.

## نطاق العمل

الالتزام بعدم لمس منطق الألغاز، AdMob، المصادقة، أو أي شيء خارج طبقة الدردشة الاجتماعية.

### 1) قاعدة البيانات (ترحيل واحد)
- إضافة `profiles.bio`, `profiles.username_changed_at`, `profiles.privacy_last_seen`, `profiles.privacy_friend_requests`, `profiles.privacy_messages` (تعداد: everyone/friends/none).
- إضافة `conversations.pinned_by[]`, `archived_by[]`.
- إضافة `messages.read_at`, `messages.delivered_at`, وجدول `typing_indicators` (channel-only، بدون تخزين).
- قيد على `friends` بحد أقصى 100 صديق (trigger).
- دالة `set_username(new_username)` تفرض قواعد التنسيق ومدة 30 يوم.
- تفعيل Realtime على `messages`, `notifications`, `friend_requests`, `user_presence`, `conversations`.
- سياسات مشددة: الرسائل تُقرأ فقط إذا `are_friends` وغير محظور. `blocked_users` يُخفي المستخدمين من كل الاستعلامات.

### 2) طبقة الواجهة (React + shadcn + RTL)
- **UsernameSetup**: تحقق live من التوفر، regex عربي/إنجليزي، منع تغيير قبل 30 يوم.
- **ChatHome**: تبويبات (بحث، أصدقاء، طلبات، دردشات، إشعارات، إعدادات) مع شارات غير مقروءة.
- **ChatSearch**: debounced live search، عرض حالة الصداقة وزر إجراء لكل نتيجة.
- **ChatFriends**: قوائم أصدقاء + طلبات واردة/صادرة مع أزرار قبول/رفض/حظر.
- **ChatConversation**: قائمة رسائل افتراضية (virtualized) + مؤشر كتابة + إيصالات ✓ ✓✓ + auto-scroll + infinite scroll للأعلى + Enter/Shift+Enter.
- **ChatNotifications**: Realtime push in-app + عداد.
- **ChatSettings/ChatPrivacy**: خصوصية آخر ظهور/طلبات/رسائل، محظورون، حذف كل الدردشات، حذف حساب الدردشة (يمسح صف profile chat fields فقط).
- **ProfileMenu**: عرض ملف، رسالة، حظر، إلغاء صداقة، إبلاغ.
- **ReportDialog**: 6 فئات → INSERT في `reports`.
- **Presence**: تحديث `last_seen_at` كل 30 ثانية + قناة Realtime presence.
- **Content filter**: قائمة كلمات AR/EN تُستبدل قبل الإرسال.
- **Rate limit**: 10 رسائل/دقيقة عبر sliding window في العميل + trigger DB.

### 3) الإدارة والوثائق
- إضافة تبويب "Moderation" في `Admin.tsx`: قائمة `reports` مفتوحة، أزرار كتم/حظر/حذف رسالة/إزالة صورة.
- تحديث `Privacy.tsx` و`Terms.tsx` بأقسام الدردشة الجديدة.

### 4) الأداء والجودة
- lazy-load كل مسارات `/chat/*`.
- Skeleton loaders، empty states، error boundaries.
- إصلاح كل أخطاء TypeScript وESLint الناتجة.

## ما لن يُلمس
- `src/lib/ads.ts`, `RiddleCard.tsx`, `HorrorClock.tsx`, `Index.tsx` (منطق الألغاز)، `EmailAuthScreen.tsx`، جداول الألغاز/المسابقة، capacitor config.

## التقنيات
- إعادة استخدام shadcn/ui، framer-motion، lucide، supabase-js، @tanstack/react-query، react-window للـ virtualization.

## المخرجات على GitHub
كل التغييرات تُدفع تلقائياً عبر مزامنة Lovable↔GitHub؛ لا حاجة لأوامر git يدوية.

---

**تحذير:** هذا حجم عمل ضخم (12+ صفحة، ترحيل كبير، Realtime، إشراف). سيستغرق عدة دورات لبنائه ومراجعته. أقترح تنفيذه على 3 مراحل:

1. **المرحلة 1:** الترحيل + `UsernameSetup` + الخصوصية + سياسات RLS المشددة + Realtime.
2. **المرحلة 2:** `ChatHome`/`Search`/`Friends`/`Requests` + الإشعارات + الحضور.
3. **المرحلة 3:** `ChatConversation` كامل (typing، receipts، virtualization) + Admin moderation + تحديث الوثائق.

هل توافق على البدء بالمرحلة 1 الآن؟ أم تريد ترتيباً مختلفاً؟