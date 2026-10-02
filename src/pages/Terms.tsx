import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const APP_NAME = "ربح";
const CONTACT_EMAIL = "support@rebh-app.com";
const LAST_UPDATED = "30 سبتمبر 2026";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-primary">شروط الاستخدام</h1>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-typewriter"
          >
            <span>العودة إلى الرئيسية</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 font-typewriter leading-loose text-right">
        <p className="text-sm text-muted-foreground mb-6">آخر تحديث: {LAST_UPDATED}</p>

        <Section title="1. القبول بالشروط">
          <p>
            باستخدامك تطبيق <strong>{APP_NAME}</strong> فإنك توافق على الالتزام
            بهذه الشروط. إذا لم توافق على أي بند منها، يُرجى عدم استخدام التطبيق.
          </p>
        </Section>

        <Section title="2. وصف الخدمة">
          <p>
            {APP_NAME} هو تطبيق ألغاز ذكية باللغة العربية يضم 400 لغز، ويتضمن
            أيضًا ميزات دردشة اجتماعية (رسائل ومكالمات ومجموعات وقصص). التطبيق
            مجاني للتحميل والاستخدام، ويعتمد على إعلانات Unity LevelPlay، كما
            يتيح مشتريات اختيارية داخل التطبيق كما هو موضّح أدناه.
          </p>
        </Section>

        <Section title="3. أهلية الاستخدام">
          <ul className="list-disc pr-6 space-y-2">
            <li>يجب أن يكون عمرك 13 عامًا على الأقل لاستخدام التطبيق.</li>
            <li>عليك تقديم بيانات صحيحة عند تسجيل الدخول أو إدخال بيانات المشاركة.</li>
          </ul>
        </Section>

        <Section title="4. الحساب والأمان">
          <p>
            أنت المسؤول الوحيد عن الحفاظ على سرية بيانات حسابك (Google) وعن أي
            نشاط يتم من خلاله. يحق لنا تعليق أو حذف أي حساب يُستخدم بشكل
            مخالف لهذه الشروط. يمكنك حذف حسابك في أي وقت من صفحة حذف الحساب.
          </p>
        </Section>

        <Section title="5. السلوك المحظور والدردشة">
          <ul className="list-disc pr-6 space-y-2">
            <li>محاولة اختراق التطبيق أو خوادمه.</li>
            <li>استخدام أي أدوات آلية أو سكربتات للعب نيابةً عنك.</li>
            <li>المضايقة أو التهديد أو خطاب الكراهية أو الاحتيال أو انتحال الشخصية.</li>
            <li>إرسال محتوى جنسي أو عنيف صريح أو رسائل مزعجة (سبام).</li>
            <li>نشر محتوى ينتهك حقوق الآخرين.</li>
          </ul>
          <p className="mt-2">
            يمكن لأي مستخدم حظر الآخرين والإبلاغ عنهم. تؤدي البلاغات المتكررة
            إلى كتم الحساب مؤقتًا ثم إيقافه، وقد يصل الأمر إلى الإيقاف الدائم
            بقرار من فريق الإشراف. راجع أيضًا إرشادات المجتمع داخل الدردشة.
          </p>
        </Section>

        <Section title="6. المشتريات داخل التطبيق">
          <ul className="list-disc pr-6 space-y-2">
            <li>
              يتيح التطبيق مشتريات اختيارية بدفعة واحدة (وليست اشتراكًا)، مثل
              إزالة الإعلانات وشراء إجابات صحيحة، وتتم عبر Google Play.
            </li>
            <li>الأسعار تُعرض قبل الشراء، وتخضع سياسات الدفع والاسترداد لمتجر Google Play.</li>
            <li>المشتريات مرتبطة بحسابك ولا يمكن نقلها إلى حساب آخر.</li>
          </ul>
        </Section>

        <Section title="7. الجوائز والترتيب">
          <p>
            قد نعلن عن جوائز أسبوعية لصاحب أسرع إجابة صحيحة. نحتفظ بالحق في
            استبعاد أي نتيجة يثبت أنها جاءت بطرق مخالفة لهذه الشروط، وقرارنا
            في ذلك نهائي.
          </p>
        </Section>

        <Section title="8. الملكية الفكرية">
          <p>
            جميع الألغاز والنصوص والصور والتصميمات داخل التطبيق ملك خاص لـ
            {" "}{APP_NAME}. لا يجوز نسخها أو إعادة نشرها دون إذن كتابي مسبق.
          </p>
        </Section>

        <Section title="9. حدود المسؤولية">
          <p>
            يُقدَّم التطبيق "كما هو" دون أي ضمانات صريحة أو ضمنية. لا نتحمل
            المسؤولية عن أي أضرار غير مباشرة قد تنتج عن استخدامك للتطبيق.
          </p>
        </Section>

        <Section title="10. تعديل الشروط">
          <p>
            يحق لنا تعديل هذه الشروط في أي وقت. ويُعدّ استمرارك في استخدام
            التطبيق بعد التعديل قبولًا للشروط الجديدة.
          </p>
        </Section>

        <Section title="11. إنهاء الخدمة">
          <p>
            يحق لنا تعليق أو إنهاء وصولك إلى التطبيق في أي وقت إذا انتهكت هذه
            الشروط أو أيًا من سياساتنا.
          </p>
        </Section>

        <Section title="12. التواصل">
          <p>
            لأي استفسار حول شروط الاستخدام، يُرجى مراسلتنا على:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-border/40 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary hover:underline font-typewriter"
          >
            <span>العودة إلى الصفحة الرئيسية</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="font-horror text-xl text-primary mb-3">{title}</h2>
    <div className="text-base text-foreground/90 space-y-2">{children}</div>
  </section>
);

export default Terms;
