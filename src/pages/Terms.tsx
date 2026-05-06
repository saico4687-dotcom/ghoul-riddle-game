import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const APP_NAME = "ألغاز الرعب";
const CONTACT_EMAIL = "support@ghoul-riddle-game.com";
const LAST_UPDATED = "6 مايو 2026";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-blood">شروط الاستخدام</h1>
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
        <p className="text-sm text-muted-foreground mb-6">
          آخر تحديث: {LAST_UPDATED}
        </p>

        <Section title="1. القبول بالشروط">
          <p>
            باستخدامك تطبيق <strong>{APP_NAME}</strong> فإنك توافق على الالتزام
            بهذه الشروط. إذا لم توافق على أي بند منها، يُرجى عدم استخدام التطبيق.
          </p>
        </Section>

        <Section title="2. وصف الخدمة">
          <p>
            التطبيق يقدّم تجربة ألغاز رعب تفاعلية باللغة العربية، مع قسمين:
            ألغاز ترفيهية مفتوحة للجميع، وألغاز مسابقة تتطلب تسجيل دخول
            ومشاركة برسوم رمزية للدخول في سحب على جوائز.
          </p>
        </Section>

        <Section title="3. أهلية الاستخدام">
          <ul className="list-disc pr-6 space-y-2">
            <li>يجب أن يكون عمرك 13 عامًا على الأقل لاستخدام التطبيق.</li>
            <li>للمشاركة في المسابقة وسحب الجوائز يجب أن تكون 18 عامًا فأكثر.</li>
            <li>عليك تقديم بيانات صحيحة ودقيقة عند التسجيل أو الدفع.</li>
          </ul>
        </Section>

        <Section title="4. الحساب والأمان">
          <p>
            أنت المسؤول الوحيد عن الحفاظ على سرية بيانات حسابك (Google) وعن أي
            نشاط يتم من خلاله. يحق لنا تعليق أو حذف أي حساب يُستخدم بشكل
            احتيالي أو يخالف هذه الشروط.
          </p>
        </Section>

        <Section title="5. المسابقة والدفع">
          <ul className="list-disc pr-6 space-y-2">
            <li>
              الدخول في سحب الجوائز يتطلب دفع رسوم اشتراك رمزية يتم التحقق منها
              يدويًا من قِبَل فريق المراجعة.
            </li>
            <li>
              يتم اختيار الفائزين بشكل عشوائي بين المشتركين الذين تم التحقق من
              دفعهم خلال فترة المسابقة.
            </li>
            <li>
              لا تُستردّ رسوم الاشتراك بعد الموافقة على الدفع والدخول في السحب.
            </li>
            <li>
              في حال رفض إثبات الدفع لعدم صحته، يُمكنك رفع إثبات بديل دون رسوم
              إضافية.
            </li>
          </ul>
        </Section>

        <Section title="6. السلوك المحظور">
          <ul className="list-disc pr-6 space-y-2">
            <li>محاولة اختراق التطبيق أو خوادمه.</li>
            <li>تزوير إثباتات الدفع أو إنشاء حسابات وهمية.</li>
            <li>استخدام أي أدوات آلية أو سكربتات للعب نيابةً عنك.</li>
            <li>نشر محتوى مسيء أو ينتهك حقوق الآخرين.</li>
          </ul>
        </Section>

        <Section title="7. الملكية الفكرية">
          <p>
            جميع الألغاز، النصوص، الصور، الأصوات، والتصميمات داخل التطبيق ملك
            خاص لـ {APP_NAME}. لا يجوز نسخها أو إعادة نشرها دون إذن كتابي مسبق.
          </p>
        </Section>

        <Section title="8. حدود المسؤولية">
          <p>
            يُقدَّم التطبيق "كما هو" دون أي ضمانات صريحة أو ضمنية. لا نتحمل
            المسؤولية عن أي أضرار غير مباشرة قد تنتج عن استخدامك للتطبيق، بما
            في ذلك انقطاع الخدمة أو فقدان البيانات.
          </p>
        </Section>

        <Section title="9. تعديل الشروط">
          <p>
            يحق لنا تعديل هذه الشروط في أي وقت. سنقوم بإشعارك بأي تغييرات
            جوهرية، ويُعدّ استمرارك في استخدام التطبيق بعد التعديل قبولًا
            للشروط الجديدة.
          </p>
        </Section>

        <Section title="10. إنهاء الخدمة">
          <p>
            يحق لنا تعليق أو إنهاء وصولك إلى التطبيق في أي وقت، ودون إشعار
            مسبق، إذا انتهكت هذه الشروط أو أيًا من سياساتنا.
          </p>
        </Section>

        <Section title="11. القانون الحاكم">
          <p>
            تخضع هذه الشروط لقوانين الدولة التي يتم تشغيل التطبيق منها، ويتم
            حلّ أي نزاع وديًا أو عبر الجهات القضائية المختصة.
          </p>
        </Section>

        <Section title="12. التواصل">
          <p>
            لأي استفسار حول شروط الاستخدام، يُرجى مراسلتنا على:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
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

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-8">
    <h2 className="font-horror text-xl text-primary mb-3">{title}</h2>
    <div className="text-base text-foreground/90 space-y-2">{children}</div>
  </section>
);

export default Terms;
