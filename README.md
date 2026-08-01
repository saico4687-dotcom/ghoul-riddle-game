# تطبيق الدردشة (Ghoul Chat)

تطبيق دردشة كامل بالعربي (RTL)، مبني بـ **React + TypeScript + Vite** من جهة
الواجهة، و **Supabase** (قاعدة بيانات Postgres + Auth + Realtime + Storage +
Edge Functions) من جهة السيرفر. المكالمات الصوتية/الفيديو بث مباشر
**WebRTC** بدون أي تسجيل، والوسائط (صور/صوت/فيديو) تُخزَّن مؤقتًا ومشفّرة
مع مهلة صلاحية تلقائية (Ephemeral TTL Storage) — راجع قسم "الوسائط والخصوصية"
تحت.

## المتطلبات

- Node.js 18+ و npm
- حساب [Supabase](https://supabase.com) (الخطة المجانية كافية للبدء)
- [Supabase CLI](https://supabase.com/docs/guides/cli) لو هتشغّل الهجرات
  (Migrations) والـ Edge Functions محليًا أو تنشرها

## التشغيل محليًا

```sh
# 1) تثبيت الحزم
npm install

# 2) نسخ متغيرات البيئة وتعبئتها (راجع القسم اللي تحت لشرح كل متغيّر)
cp .env.example .env

# 3) تشغيل السيرفر المحلي
npm run dev
```

التطبيق هيشتغل على `http://localhost:8080` (أو البورت اللي فايت بيختاره لو
مشغول). المشروع PWA-ready وResponsive، فبيشتغل على الموبايل والويب بنفس
الكود، وبيدعم تثبيته كتطبيق (Add to Home Screen) بفضل `manifest.json` و
Service Worker المدمجين.

للنسخة الأصلية للموبايل (Android عبر Capacitor)، راجع مجلد `android/`
— المشروع مهيّأ بالفعل بـ `capacitor.config.ts`.

## متغيرات البيئة

### 1) العميل (ملف `.env` في جذر المشروع)

| المتغيّر | إلزامي؟ | الوصف |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | رابط مشروع Supabase (Project Settings → API) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | مفتاح anon/publishable العام (نفس الصفحة) |
| `VITE_SUPABASE_PROJECT_ID` | ✅ | معرّف المشروع |
| `VITE_TURN_URL` | اختياري | رابط سيرفر TURN، مثل `turn:your-turn-host:3478` |
| `VITE_TURN_USERNAME` | اختياري | اسم مستخدم TURN |
| `VITE_TURN_CREDENTIAL` | اختياري | كلمة مرور/بيانات اعتماد TURN |

بدون `VITE_TURN_*`، المكالمات تعتمد على STUN فقط (`stun.l.google.com`)
وتشتغل تمام على أغلب شبكات الواي فاي/المنازل، لكنها **ممكن تفشل خلف NAT
صارم أو شبكات شركات/4G مقيّدة** — وهو سيناريو شائع جدًا في الإنتاج. لتغطية
هذه الحالة لازم TURN حقيقي، مثلاً:
- [Twilio Network Traversal Service](https://www.twilio.com/docs/stun-turn) (مدفوع، سهل الإعداد)
- [coturn](https://github.com/coturn/coturn) ذاتي الاستضافة (مجاني، يحتاج سيرفر خاص بيه)

### 2) السيرفر (Supabase → Project Settings → Edge Functions → Secrets)

هذه المتغيرات بتتحط في لوحة Supabase نفسها (مش في `.env` بتاع العميل) لأنها
مفاتيح حساسة تخص السيرفر فقط:

| المتغيّر | الوصف |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | زوج مفاتيح Web Push — يُولَّد مرة واحدة بأمر `npx web-push generate-vapid-keys`. المفتاح العام لازم يتحط كمان في `src/lib/chat/push.ts` (`VAPID_PUBLIC_KEY`) لأنه آمن يكون في كود العميل بطبيعته |
| `VAPID_SUBJECT` | بريد تواصل بصيغة `mailto:you@example.com` (يُطلَب من مواصفة Web Push) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | متوفّرة تلقائيًا لأي Edge Function داخل مشروعك، مفيش داعي تضيفها يدويًا |
| `CLEANUP_CRON_SECRET` | مفتاح سري بسيط يتحقق منه `cleanup-expired-media` عشان محدش ينادي الدالة من برّه الجدولة (راجع `supabase/functions/cleanup-expired-media/index.ts`) |

## بنية المشروع

```
src/
  components/     مكوّنات الواجهة (فقاعات الرسائل، شاشة المكالمة، لوحة الإشراف...)
  hooks/          useAuth, useCall, useGroupChat, ...
  lib/chat/       منطق الدردشة: queries.ts, groupQueries.ts, webrtc.ts, push.ts, formatting.ts
  pages/chat/     شاشات الدردشة (المحادثات، الجروبات، الملف الشخصي، الإعدادات)
  integrations/supabase/   عميل Supabase + الأنواع (types.ts) المولَّدة من قاعدة البيانات
supabase/
  migrations/     كل تغييرات قاعدة البيانات (SQL) بالترتيب الزمني
  functions/      Edge Functions: send-push, cleanup-expired-media, delete-account, ack-media-view
public/
  push-sw.js      Service Worker إضافي مسؤول عن استقبال Push الحقيقي وعرضه كإشعار نظام
```

## المكالمات الصوتية/الفيديو (WebRTC)

- بث مباشر P2P بالكامل عبر `RTCPeerConnection` — **بدون أي تسجيل أو تخزين**
  للصوت/الفيديو في أي مرحلة.
- Supabase (جدول `call_signals` + Realtime) يُستخدم فقط كقناة إشارة
  (Signaling) لتبادل SDP/ICE بين الطرفين — راجع `src/hooks/useCall.ts`
  و `src/lib/chat/webrtc.ts`.
- عند انقطاع الشبكة، فيه منطق إعادة اتصال تلقائي (`restartIce` + مهلة سماح
  10 ثوانٍ) قبل اعتبار المكالمة منتهية فعليًا، مع مؤشر "جاري إعادة
  الاتصال..." في الواجهة.
- تبديل الكاميرا الأمامية/الخلفية أثناء المكالمة عبر `replaceTrack` بدون
  إعادة تفاوض أو قطع الاتصال.
- **إشعار المكالمة لما التطبيق مقفول تمامًا**: عند بدء مكالمة، بيتبعت Push
  حقيقي (`type: "call"`) للطرف التاني عبر `send-push`. الـ Service Worker
  (`public/push-sw.js`) بيعرضه كإشعار "مُلح" (`requireInteraction` + اهتزاز
  متكرر شبه نغمة الرنين) بدل إشعار عادي بيختفي لوحده. عند فتح التطبيق من
  الإشعار، `useCall.ts` بيفحص تلقائيًا هل فيه مكالمة `ringing` موجّهة
  للمستخدم (لأن صف الإشارة الأول ممكن يكون فات قبل ما الاشتراك اللحظي يبدأ
  يسمع)، فتظهر شاشة الرنين فورًا.

## الوسائط والخصوصية

- الصور/الفيديو/الرسائل الصوتية تُشفَّر على جهاز المرسل وتُرفع كملف مؤقت له
  مهلة صلاحية (TTL) — تُحذف تلقائيًا فور تأكيد الاستلام أو بعد أقصى مهلة
  ثابتة، عبر Edge Function مجدولة (`cleanup-expired-media`، تعمل كل 15
  دقيقة عبر `pg_cron`).
- الحالة/الستوري نفس المبدأ لكن بمهلة صلاحية 24 ساعة بالضبط من وقت النشر.
- النص (محتوى الرسائل، الطوابع الزمنية، حالات القراءة...) يُخزَّن بشكل عادي
  ودائم في قاعدة البيانات.

## قاعدة البيانات (Supabase)

كل تغييرات المخطط (Schema) موثّقة كملفات SQL مرتّبة زمنيًا في
`supabase/migrations/`. لتطبيقها على مشروع Supabase الخاص بيك:

```sh
supabase login
supabase link --project-ref <project-id>
supabase db push
```

## نشر Edge Functions

```sh
supabase functions deploy send-push
supabase functions deploy cleanup-expired-media
supabase functions deploy delete-account
supabase functions deploy ack-media-view
```

بعد نشر `cleanup-expired-media`، تأكد إن جدولة `pg_cron` (موجودة ضمن
الهجرات) فعّالة من لوحة Supabase → Database → Cron Jobs.

## البناء للإنتاج

```sh
npm run build
```

الناتج بيتحط في `dist/` جاهز للنشر على أي استضافة استاتيك (Vercel, Netlify,
Cloudflare Pages...) أو خلف Capacitor للموبايل.
