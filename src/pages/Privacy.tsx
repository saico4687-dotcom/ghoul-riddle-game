import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const APP_NAME = "ربح";
const CONTACT_EMAIL = "support@rebh-app.com";
const LAST_UPDATED = "6 مايو 2026";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-primary">سياسة الخصوصية</h1>
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

        <section className="mb-8">
          <p className="text-base">
            نحن في تطبيق <strong>{APP_NAME}</strong> نحترم خصوصيتك ونلتزم بحماية
            بياناتك الشخصية. توضح هذه السياسة أنواع المعلومات التي نقوم بجمعها،
            وكيفية استخدامها وحقوقك تجاهها، وذلك وفقًا لمتطلبات Google Play
            وقوانين حماية البيانات المعمول بها.
          </p>
        </section>

        <Section title="1. المعلومات التي نقوم بجمعها">
          <ul className="list-disc pr-6 space-y-2 mt-2">
            <li>
              <strong>بيانات الحساب:</strong> الاسم، البريد الإلكتروني، وصورة
              الملف الشخصي عند تسجيل الدخول عبر Google.
            </li>
            <li>
              <strong>بيانات اللعب:</strong> تقدّمك في الألغاز ونتائجك ورقم
              اللغز الحالي لاستئناف اللعب لاحقًا.
            </li>
            <li>
              <strong>بيانات تقنية:</strong> نوع الجهاز ونظام التشغيل وسجلات
              الأخطاء لتحسين أداء التطبيق.
            </li>
          </ul>
        </Section>

        <Section title="2. كيفية استخدام البيانات">
          <ul className="list-disc pr-6 space-y-2">
            <li>تشغيل التطبيق وتقديم تجربة لعب مخصصة لك.</li>
            <li>حفظ تقدمك حتى تستطيع استكمال اللعب من حيث توقفت.</li>
            <li>تحسين أداء التطبيق وإصلاح الأخطاء.</li>
          </ul>
        </Section>

        <Section title="3. مشاركة البيانات مع أطراف ثالثة">
          <p>
            نحن لا نبيع بياناتك الشخصية لأي طرف ثالث. نشارك البيانات فقط مع
            مزودي الخدمات الضروريين لتشغيل التطبيق:
          </p>
          <ul className="list-disc pr-6 space-y-2 mt-2">
            <li><strong>Google Sign-In:</strong> للمصادقة وتسجيل الدخول.</li>
            <li><strong>خدمة قاعدة البيانات السحابية:</strong> لتخزين بياناتك بشكل آمن.</li>
            <li><strong>Google AdMob:</strong> لعرض الإعلانات داخل التطبيق.</li>
          </ul>
        </Section>

        <Section title="4. حماية البيانات">
          <p>
            نستخدم تقنيات تشفير حديثة وسياسات أمان صارمة لضمان عدم وصول أي مستخدم
            إلى بيانات مستخدم آخر. جميع الاتصالات بخوادمنا تتم عبر بروتوكول HTTPS الآمن.
          </p>
        </Section>

        <Section title="5. الاحتفاظ بالبيانات وحذف الحساب">
          <p>
            نحتفظ ببياناتك طالما أن حسابك نشط. يمكنك طلب حذف حسابك وجميع بياناتك
            في أي وقت بمراسلتنا على البريد الإلكتروني المذكور أدناه، وسيتم تنفيذ
            الطلب خلال مدة أقصاها 30 يومًا.
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
            للتواصل معنا:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
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

        <Section title="8. الأذونات المطلوبة">
          <ul className="list-disc pr-6 space-y-2">
            <li><strong>الإنترنت:</strong> للاتصال بخوادمنا وحفظ تقدمك.</li>
            <li><strong>معرّف الإعلانات (Advertising ID):</strong> لعرض إعلانات Google AdMob.</li>
          </ul>
        </Section>

        <Section title="9. الإعلانات (Google AdMob)">
          <p>
            يعتمد التطبيق على إعلانات <strong>Google AdMob</strong> للحفاظ على
            مجانيته. قد تقوم Google ومزوّدوها بجمع واستخدام معرّف الإعلانات
            الخاص بجهازك لعرض إعلانات أكثر ملاءمة وقياس أدائها، وذلك وفقًا
            لـ{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              سياسة Google للشركاء الإعلانيين
            </a>
            . يمكنك في أي وقت اختيار إعلانات غير مخصّصة من شاشة الموافقة داخل
            التطبيق، أو إعادة ضبط/تعطيل معرّف الإعلانات من إعدادات جهازك.
          </p>
          <p className="mt-2">
            داخل الاتحاد الأوروبي والمملكة المتحدة، نعرض شاشة موافقة (UMP) من
            Google قبل تحميل أي إعلانات.
          </p>
        </Section>

        <Section title="10. التغييرات على السياسة">
          <p>
            قد نقوم بتحديث هذه السياسة من وقت لآخر. سنقوم بإشعارك بأي تغييرات
            جوهرية عبر التطبيق، وسيُذكر تاريخ آخر تحديث في أعلى هذه الصفحة.
          </p>
        </Section>

        <Section title="11. التواصل معنا">
          <p>
            لأي استفسار يخص سياسة الخصوصية، يُرجى مراسلتنا على:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <Section title="12. حذف الحساب / تسجيل الخروج">
          <p>
            يمكنك حذف حسابك أو تسجيل الخروج في أي وقت من خلال الأزرار التالية:
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link
              to="/delete-account"
              className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition font-typewriter"
            >
              Delete My Account
            </Link>
            <button
              onClick={async () => {
                const { supabase } = await import("@/integrations/supabase/client");
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="inline-flex items-center justify-center px-5 py-3 rounded-md border border-border bg-card text-foreground hover:bg-muted transition font-typewriter"
            >
              Log Out
            </button>
          </div>
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

export default Privacy;
