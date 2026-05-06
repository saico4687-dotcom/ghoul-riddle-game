import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const APP_NAME = "ألغاز الرعب";
const CONTACT_EMAIL = "support@ghoul-riddle-game.com";
const LAST_UPDATED = "1 مايو 2026";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* SEO basics */}
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-blood">سياسة الخصوصية</h1>
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <p className="text-sm text-muted-foreground">
            آخر تحديث: {LAST_UPDATED}
          </p>
          <a
            href="/privacy-policy.pdf"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span>تحميل PDF</span>
          </a>
        </div>

        <section className="mb-8">
          <p className="text-base">
            نحن في تطبيق <strong>{APP_NAME}</strong> نحترم خصوصيتك ونلتزم بحماية
            بياناتك الشخصية. توضح هذه السياسة أنواع المعلومات التي نقوم بجمعها،
            وكيفية استخدامها، ومشاركتها، وحقوقك تجاهها، وذلك وفقًا لمتطلبات
            Google Play وقوانين حماية البيانات المعمول بها.
          </p>
        </section>

        <Section title="1. المعلومات التي نقوم بجمعها">
          <p>عند استخدامك للتطبيق، قد نقوم بجمع الأنواع التالية من البيانات:</p>
          <ul className="list-disc pr-6 space-y-2 mt-2">
            <li>
              <strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، وصورة
              الملف الشخصي عند تسجيل الدخول عبر Google.
            </li>
            <li>
              <strong>بيانات اللعب:</strong> تقدمك في الألغاز، نتائجك، ورقم
              السؤال الحالي لاستئناف اللعب لاحقًا.
            </li>
            <li>
              <strong>بيانات المسابقة والسحب:</strong> الاسم الكامل، رقم
              الهاتف، العنوان، ورقم هاتف الدفع — وذلك فقط عند اختيار
              المشاركة في السحب.
            </li>
            <li>
              <strong>إثبات الدفع:</strong> صورة لقطة الشاشة الخاصة بعملية
              الدفع، تاريخ ووقت العملية لمراجعتها يدويًا.
            </li>
            <li>
              <strong>بيانات تقنية:</strong> معرّف الجهاز، نوع الجهاز، نظام
              التشغيل، وسجلات الأخطاء لتحسين أداء التطبيق.
            </li>
          </ul>
        </Section>

        <Section title="2. كيفية استخدام البيانات">
          <ul className="list-disc pr-6 space-y-2">
            <li>تشغيل التطبيق وتقديم تجربة لعب مخصصة لك.</li>
            <li>حفظ تقدمك حتى تستطيع استكمال اللعب من حيث توقفت.</li>
            <li>إدارة اشتراكك في المسابقة والسحب على الجوائز.</li>
            <li>التحقق من عمليات الدفع يدويًا من قِبَل فريق المراجعة.</li>
            <li>التواصل معك بخصوص المسابقة أو الجوائز عند الفوز.</li>
            <li>تحسين أداء التطبيق وإصلاح الأخطاء.</li>
          </ul>
        </Section>

        <Section title="3. مشاركة البيانات مع أطراف ثالثة">
          <p>
            نحن لا نبيع بياناتك الشخصية لأي طرف ثالث. نشارك البيانات فقط مع
            مزودي الخدمات الضروريين لتشغيل التطبيق:
          </p>
          <ul className="list-disc pr-6 space-y-2 mt-2">
            <li>
              <strong>Google Sign-In:</strong> للمصادقة وتسجيل الدخول.
            </li>
            <li>
              <strong>خدمة قاعدة البيانات السحابية (Supabase):</strong> لتخزين
              بياناتك بشكل آمن.
            </li>
          </ul>
          <p className="mt-2">
            قد نُفصح عن بياناتك إذا طُلب منا ذلك بموجب القانون أو لحماية حقوق
            التطبيق ومستخدميه.
          </p>
        </Section>

        <Section title="4. حماية البيانات">
          <p>
            نستخدم تقنيات تشفير حديثة وسياسات أمان صارمة (Row Level Security)
            لضمان عدم وصول أي مستخدم إلى بيانات مستخدم آخر. جميع الاتصالات
            بخوادمنا تتم عبر بروتوكول HTTPS الآمن.
          </p>
        </Section>

        <Section title="5. الاحتفاظ بالبيانات">
          <p>
            نحتفظ ببياناتك طالما أن حسابك نشط أو طالما كان ذلك ضروريًا لتقديم
            خدماتنا. يمكنك طلب حذف حسابك وبياناتك في أي وقت بمراسلتنا على
            البريد الإلكتروني المذكور أدناه.
          </p>
        </Section>

        <Section title="6. حقوق المستخدم">
          <ul className="list-disc pr-6 space-y-2">
            <li>الحق في الوصول إلى بياناتك الشخصية.</li>
            <li>الحق في تصحيح أو تحديث بياناتك.</li>
            <li>الحق في حذف حسابك وجميع بياناتك المرتبطة به.</li>
            <li>الحق في سحب موافقتك على معالجة البيانات في أي وقت.</li>
          </ul>
          <p className="mt-2">
            لتنفيذ أيٍّ من هذه الحقوق، يُرجى التواصل معنا على:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <Section title="7. خصوصية الأطفال">
          <p>
            هذا التطبيق غير مُوجَّه للأطفال دون سن الثالثة عشرة. نحن لا نجمع
            عمدًا أي بيانات شخصية من الأطفال. إذا علمنا بأننا جمعنا بيانات من
            طفل، فسنقوم بحذفها فورًا.
          </p>
        </Section>

        <Section title="8. الأذونات المطلوبة من التطبيق">
          <ul className="list-disc pr-6 space-y-2">
            <li>
              <strong>الإنترنت:</strong> للاتصال بخوادمنا وحفظ تقدمك.
            </li>
            <li>
              <strong>الوصول إلى الصور / الملفات:</strong> فقط عند رفع صورة
              إثبات الدفع.
            </li>
            <li>
              <strong>الاتصال الهاتفي (USSD):</strong> فقط لفتح كود الدفع، ولا
              يتم إجراء أي مكالمة دون موافقتك.
            </li>
          </ul>
        </Section>

        <Section title="9. الإعلانات والتحليلات">
          <p>
            لا يحتوي التطبيق حاليًا على إعلانات من أطراف ثالثة، ولا نستخدم أي
            معرّفات إعلانية لتتبع المستخدمين عبر التطبيقات.
          </p>
        </Section>

        <Section title="10. التغييرات على سياسة الخصوصية">
          <p>
            قد نقوم بتحديث هذه السياسة من وقت لآخر. سنقوم بإشعارك بأي تغييرات
            جوهرية عبر التطبيق أو البريد الإلكتروني، وسيُذكر تاريخ آخر تحديث
            في أعلى هذه الصفحة.
          </p>
        </Section>

        <Section title="11. التواصل معنا">
          <p>
            لأي استفسار يخص سياسة الخصوصية أو بياناتك الشخصية، يُرجى مراسلتنا
            على:
          </p>
          <p className="mt-2">
            <strong>البريد الإلكتروني:</strong>{" "}
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

export default Privacy;
