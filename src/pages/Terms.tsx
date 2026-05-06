import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const APP_NAME = "ربح";
const CONTACT_EMAIL = "support@rebh-app.com";
const LAST_UPDATED = "6 مايو 2026";

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
            {APP_NAME} هو تطبيق ألغاز ذكية باللغة العربية يهدف إلى تحفيز العقل
            وتنمية مهارات التفكير من خلال 400 لغز متنوّع. التطبيق مجاني بالكامل
            ولا يتضمن أي عمليات شراء أو رسوم.
          </p>
        </Section>

        <Section title="3. أهلية الاستخدام">
          <ul className="list-disc pr-6 space-y-2">
            <li>يجب أن يكون عمرك 13 عامًا على الأقل لاستخدام التطبيق.</li>
            <li>عليك تقديم بيانات صحيحة عند تسجيل الدخول.</li>
          </ul>
        </Section>

        <Section title="4. الحساب والأمان">
          <p>
            أنت المسؤول الوحيد عن الحفاظ على سرية بيانات حسابك (Google) وعن أي
            نشاط يتم من خلاله. يحق لنا تعليق أو حذف أي حساب يُستخدم بشكل
            مخالف لهذه الشروط.
          </p>
        </Section>

        <Section title="5. السلوك المحظور">
          <ul className="list-disc pr-6 space-y-2">
            <li>محاولة اختراق التطبيق أو خوادمه.</li>
            <li>استخدام أي أدوات آلية أو سكربتات للعب نيابةً عنك.</li>
            <li>نشر محتوى مسيء أو ينتهك حقوق الآخرين.</li>
          </ul>
        </Section>

        <Section title="6. الملكية الفكرية">
          <p>
            جميع الألغاز والنصوص والصور والتصميمات داخل التطبيق ملك خاص لـ
            {" "}{APP_NAME}. لا يجوز نسخها أو إعادة نشرها دون إذن كتابي مسبق.
          </p>
        </Section>

        <Section title="7. حدود المسؤولية">
          <p>
            يُقدَّم التطبيق "كما هو" دون أي ضمانات صريحة أو ضمنية. لا نتحمل
            المسؤولية عن أي أضرار غير مباشرة قد تنتج عن استخدامك للتطبيق.
          </p>
        </Section>

        <Section title="8. تعديل الشروط">
          <p>
            يحق لنا تعديل هذه الشروط في أي وقت. ويُعدّ استمرارك في استخدام
            التطبيق بعد التعديل قبولًا للشروط الجديدة.
          </p>
        </Section>

        <Section title="9. إنهاء الخدمة">
          <p>
            يحق لنا تعليق أو إنهاء وصولك إلى التطبيق في أي وقت إذا انتهكت هذه
            الشروط أو أيًا من سياساتنا.
          </p>
        </Section>

        <Section title="10. التواصل">
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
