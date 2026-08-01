/**
 * دومين الويب الحقيقي للتطبيق — يُستخدم فى بناء أي رابط لازم يتفتح
 * من برا التطبيق (زي روابط دعوة الجروبات) بدل الاعتماد على
 * window.location.origin.
 *
 * جوّه تطبيق Capacitor الأصلي (Android/iOS) الـ origin الفعلي بيبقى
 * سكيم محلي زي "https://localhost" أو "capacitor://localhost" — مش
 * دومين حقيقي حد تاني يقدر يفتحه. فلو استخدمنا window.location.origin
 * فى رابط دعوة وبعتناه لحد تاني، هيوصله رابط زي
 * "localhost/chat/groups/join/..." مش قابل للفتح عنده خالص — وده
 * بالظبط اللي كان بيحصل.
 *
 * الحل: نستخدم الدومين المنشور فعليًا للويب دايمًا لبناء الروابط
 * القابلة للمشاركة، بغض النظر عن الـ origin الحالي اللي التطبيق شغال
 * جواه.
 *
 * القيمة تُقرأ من VITE_APP_WEB_ORIGIN (لازم تتحط في .env بعد ما تعرف
 * دومين النشر الفعلي بتاعك). لو مش متعرّفة، بيرجع لـ
 * window.location.origin كحل احتياطي وقت التطوير المحلي — ده كويس جوّه
 * المتصفح العادي، لكن جوّه تطبيق Capacitor (Android/iOS) هيرجّع سكيم
 * محلي مش قابل للفتح من حد تاني، فلازم تتأكد من ضبط المتغيّر قبل
 * النشر للإنتاج.
 */
export const APP_WEB_ORIGIN =
  (import.meta.env.VITE_APP_WEB_ORIGIN as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "");
