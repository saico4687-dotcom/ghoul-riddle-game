export default function ChatGuidelines() {
  return (
    <div className="p-6 max-w-2xl mx-auto" dir="rtl">
      <h1 className="font-horror text-3xl text-primary mb-4">إرشادات المجتمع</h1>
      <p className="font-typewriter text-sm text-foreground/80 mb-6">
        الدردشة في "ربح" مساحة آمنة. باستخدامك للدردشة فأنت توافق على هذه الإرشادات. مخالفتها قد تؤدي إلى الكتم أو الإيقاف الدائم.
      </p>

      <section className="card-horror p-4 mb-4">
        <h2 className="font-horror text-destructive mb-2">السلوكيات الممنوعة</h2>
        <ul className="space-y-2 text-sm font-typewriter list-disc pr-5">
          <li><strong>المضايقة:</strong> الإلحاح أو الاستفزاز أو إرسال رسائل غير مرغوب فيها بشكل متكرر.</li>
          <li><strong>خطاب الكراهية:</strong> أي محتوى يحقّر شخصاً أو فئة بسبب العرق أو الدين أو الجنس أو الجنسية.</li>
          <li><strong>التهديدات:</strong> أي تهديد بالعنف أو الأذى الجسدي أو النفسي.</li>
          <li><strong>السبام:</strong> رسائل دعائية متكررة، روابط ضارة، أو محتوى آلي.</li>
          <li><strong>انتحال الشخصية:</strong> ادعاء أنك شخص آخر أو ممثل عن جهة لا تنتمي لها.</li>
          <li><strong>المحتوى الصريح:</strong> صور أو نصوص جنسية أو عنيفة بشكل صريح.</li>
          <li><strong>الاحتيال:</strong> طلب أموال، كلمات مرور، أو معلومات شخصية لأغراض احتيالية.</li>
        </ul>
      </section>

      <section className="card-horror p-4 mb-4">
        <h2 className="font-horror text-primary mb-2">الإجراءات التلقائية</h2>
        <ul className="space-y-1 text-sm font-typewriter list-disc pr-5">
          <li>3 بلاغات صحيحة خلال 24 ساعة → كتم تلقائي لمدة 24 ساعة.</li>
          <li>5 بلاغات صحيحة خلال 24 ساعة → إيقاف تلقائي لمدة 7 أيام.</li>
          <li>التكرار يؤدي لإيقاف دائم بقرار من فريق الإشراف.</li>
        </ul>
      </section>

      <p className="text-xs text-muted-foreground font-typewriter">
        إذا اعتقدت أن إجراءً اتُّخذ بحقك بالخطأ، تواصل مع الدعم.
      </p>
    </div>
  );
}
