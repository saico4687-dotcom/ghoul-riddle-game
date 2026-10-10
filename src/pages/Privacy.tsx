import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const APP_NAME = "ربح";
const CONTACT_EMAIL = "support@rebh-app.com";
const LAST_UPDATED = "30 سبتمبر 2026";

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
              <strong>بيانات الحساب:</strong> الاسم والبريد الإلكتروني وصورة
              الملف الشخصي عند تسجيل الدخول عبر Google.
            </li>
            <li>
              <strong>بيانات المشاركة:</strong> الاسم الكامل ورقم الهاتف
              والعنوان إذا أدخلتها في نموذج "بيانات المشاركة".
            </li>
            <li>
              <strong>بيانات اللعب:</strong> تقدّمك في الألغاز ونتائجك ونقاطك
              وزمن إجاباتك ورقم اللغز الحالي.
            </li>
            <li>
              <strong>بيانات الدردشة:</strong> اسم المستخدم والنبذة الشخصية
              وقوائم الأصدقاء والمجموعات والرسائل والقصص وحالة الاتصال وآخر
              ظهور والبلاغات وقوائم الحظر.
            </li>
            <li>
              <strong>الوسائط:</strong> الصور والصوت والفيديو التي ترسلها في
              المحادثات، وتُخزَّن بشكل مشفّر ومؤقت وتُحذف تلقائيًا بعد انتهاء
              مدة صلاحيتها (حتى 72 ساعة)، أما القصص فتنتهي بعد 24 ساعة.
            </li>
            <li>
              <strong>سجل المشتريات:</strong> المنتجات التي اشتريتها داخل
              التطبيق وحالتها، مربوطة بحسابك. لا نطّلع على بيانات بطاقتك
              المصرفية إطلاقًا.
            </li>
            <li>
              <strong>بيانات تقنية:</strong> نوع الجهاز ونظام التشغيل وسجلات
              الأخطاء ورمز الإشعارات ومعرّف الإعلانات.
            </li>
          </ul>
        </Section>

        <Section title="2. كيفية استخدام البيانات">
          <ul className="list-disc pr-6 space-y-2">
            <li>تشغيل التطبيق وحفظ تقدمك لتكمل من حيث توقفت.</li>
            <li>احتساب النقاط والترتيب والتواصل معك بخصوص الجوائز.</li>
            <li>تشغيل الدردشة والمكالمات والإشراف على البلاغات لحماية المستخدمين.</li>
            <li>إتمام المشتريات وتفعيل ما اشتريته على حسابك.</li>
            <li>عرض الإعلانات وقياس أدائها.</li>
            <li>إرسال الإشعارات، وتحسين الأداء وإصلاح الأخطاء.</li>
          </ul>
        </Section>

        <Section title="3. مشاركة البيانات مع أطراف ثالثة">
          <p>
            نحن لا نبيع بياناتك الشخصية لأي طرف ثالث. نشارك البيانات فقط مع
            مزودي الخدمات الضروريين لتشغيل التطبيق:
          </p>
          <ul className="list-disc pr-6 space-y-2 mt-2">
            <li><strong>Google Sign-In:</strong> لتسجيل الدخول.</li>
            <li><strong>Supabase:</strong> لتخزين الحسابات والنتائج والدردشة والوسائط.</li>
            <li><strong>Google Play Billing وRevenueCat:</strong> لإتمام المشتريات وتوثيقها.</li>
            <li><strong>Unity LevelPlay:</strong> لعرض الإعلانات داخل التطبيق.</li>
          </ul>
        </Section>

        <Section title="4. حماية البيانات">
          <p>
            جميع الاتصالات بخوادمنا تتم عبر HTTPS. نصوص المحادثات الفردية
            مشفّرة من طرف إلى طرف (لا تشمل المجموعات حاليًا)، والوسائط مشفّرة
            ومؤقتة، والمكالمات الصوتية والمرئية تتم مباشرة بين الطرفين ولا
            يتم تسجيلها. ورغم ذلك لا توجد وسيلة نقل أو تخزين آمنة بنسبة 100%.
          </p>
        </Section>

        <Section title="5. الاحتفاظ بالبيانات وحذف الحساب">
          <p>
            نحتفظ ببياناتك طالما أن حسابك نشط. يمكنك حذف حسابك وبياناتك في أي
            وقت من صفحة <Link to="/delete-account" className="text-primary hover:underline">حذف الحساب</Link>{" "}
            داخل التطبيق، أو بمراسلتنا على البريد الموضّح أدناه وسننفّذ
            الطلب خلال 30 يومًا كحد أقصى. قد نحتفظ بسجلات المشتريات
            والبلاغات بالقدر الذي يفرضه القانون أو تتطلبه حماية المستخدمين.
          </p>
        </Section>

        <Section title="6. حقوق المستخدم">
          <ul className="list-disc pr-6 space-y-2">
            <li>الحق في الوصول إلى بياناتك الشخصية.</li>
            <li>الحق في تصحيح أو تحديث بياناتك.</li>
            <li>الحق في حذف حسابك وجميع بياناتك المرتبطة به.</li>
            <li>الحق في سحب موافقتك على الإعلانات المخصّصة أو الإشعارات في أي وقت.</li>
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
            <li><strong>الإنترنت وحالة الشبكة:</strong> للاتصال بخوادمنا وحفظ تقدمك.</li>
            <li><strong>الإشعارات:</strong> لتنبيهك بالرسائل وطلبات الصداقة.</li>
            <li><strong>الكاميرا:</strong> لتصوير الصور والفيديو ومكالمات الفيديو، ولا تعمل إلا عند استخدامك لها.</li>
            <li><strong>الميكروفون:</strong> للرسائل الصوتية والمكالمات ومحادثة "استعن بصديق"، ولا يعمل إلا عند استخدامك له.</li>
            <li><strong>ميزة "استعن بصديق":</strong> إذا فعّلت "أنا متاح للمساعدة" في الإعدادات وكان التطبيق مفتوحًا، قد يصلك طلب مساعدة من لاعب آخر. يظهر للطرف الآخر اسمك المستعار وصورتك فقط (وليس اسمك الحقيقي)، وتتم المحادثة الصوتية مباشرة بين الجهازين دون تسجيل أو تخزين. يمكنك إيقاف الميزة أو الإبلاغ عن الطرف الآخر أو حظره في أي وقت.</li>
            <li><strong>ميزة "التحدي" (الحلبة):</strong> تتحدى صديقًا متاحًا يختاره التطبيق عشوائيًا من أصدقائك. نحفظ "اسم الحلبة" الذي تكتبه عند التوقيع، ونتيجة التحدي ومدة الإجابة، ويظهر للطرف الآخر اسم الحلبة واسمك المستعار وصورتك فقط (وليس اسمك الحقيقي). التحدي بالصوت يتم مباشرة بين الجهازين ولا نسجّله ولا نخزّنه، ولا يبدأ إلا إذا قبل الطرف الآخر وسمح بالميكروفون. التحدي لا يمنح نقاطًا ولا يدخل في جائزة الأسبوع، واللغز الذي يُلعب في تحدٍّ ولم تجاوبه من قبل يخرج من ترتيب الجائزة عندك. يمكنك رفض أي تحدي، أو حظر الطرف الآخر أو الإبلاغ عنه، ويمكنك إيقاف استقبال التحديات بإلغاء "أنا متاح للمساعدة".</li>
            <li><strong>البصمة / القفل الحيوي:</strong> لقفل الدردشة اختياريًا، وتتم المعالجة على جهازك فقط.</li>
            <li><strong>معرّف الإعلانات (Advertising ID):</strong> لعرض إعلانات Unity LevelPlay.</li>
          </ul>
        </Section>

        <Section title="9. الإعلانات (Unity LevelPlay)">
          <p>
            يعتمد التطبيق على إعلانات <strong>Unity LevelPlay</strong> للحفاظ على
            مجانيته، ويمكنك إزالتها بالشراء من داخل التطبيق. قد تقوم Unity
            وشبكات الإعلانات المتوسّطة معها بجمع واستخدام معرّف الإعلانات الخاص
            بجهازك لعرض إعلانات أكثر ملاءمة وقياس أدائها، وذلك وفقًا لـ{" "}
            <a
              href="https://unity.com/legal/game-player-and-app-user-privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              سياسة خصوصية Unity لمستخدمي التطبيقات
            </a>
            . يمكنك في أي وقت اختيار إعلانات غير مخصّصة من شاشة الموافقة داخل
            التطبيق، أو إعادة ضبط/تعطيل معرّف الإعلانات من إعدادات جهازك.
          </p>
          <p className="mt-2">
            نعرض شاشة موافقة قبل تحميل أي إعلانات، ويمكنك تغيير اختيارك
            (مخصّصة / غير مخصّصة) في أي وقت من الزر في قسم "خيارات الخصوصية
            والإعلانات" أدناه.
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

        <Section title="12. خيارات الخصوصية والإعلانات">
          <p>
            يمكنك في أي وقت مراجعة أو تغيير اختياراتك بخصوص الإعلانات
            المخصّصة عن طريق الزر التالي:
          </p>
          <div className="mt-4">
            <button
              onClick={async () => {
                try {
                  const { showPrivacyOptions } = await import("@/lib/adsMediation");
                  await showPrivacyOptions();
                } catch (e: any) {
                  if (e?.message === "NOT_NATIVE") {
                    toast({
                      title: "غير متاح على المتصفح",
                      description:
                        "خيارات الخصوصية الخاصة بالإعلانات متاحة فقط داخل تطبيق الجوال، وليس عبر المتصفح.",
                    });
                  } else {
                    toast({
                      title: "تعذّر فتح خيارات الخصوصية",
                      description:
                        "قد لا يكون هناك نموذج خصوصية متاح حاليًا لمنطقتك، أو حدث خطأ مؤقت. حاول لاحقًا.",
                      variant: "destructive",
                    });
                  }
                }
              }}
              className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition font-typewriter"
            >
              خيارات الخصوصية (Privacy Options)
            </button>
          </div>
        </Section>

        <Section title="13. حذف الحساب / تسجيل الخروج">
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

        <Section title="14. الدردشة المجانية لأوائل الألف ومحادثة المساعدة">
          <ul className="list-disc pr-6 space-y-2">
            <li>
              <strong>الدردشة الاجتماعية:</strong> هي غير مفتوحة حاليًا. ننوي، بإذن
              الله، فتحها مجانًا للألف الأوائل ممن أنهوا جميع الألغاز، وهي مخصصة
              للحوار بالأفكار والعقول. الموعد والتفاصيل قابلة للتغيير، وستصلك
              إشعارات عند فتحها.
            </li>
            <li>
              <strong>ميزة "استعن بصديق":</strong> متاحة حاليًا. تتم المحادثة الصوتية
              بين اللاعب والمساعد مباشرة بين الجهازين ولا نسجّلها ولا نخزّنها.
              يظهر للطرف الآخر اسمك المستعار وصورتك فقط. يُعرض لك المساعد بلقب "سَنَد" واسمه المستعار فقط. عند وجود أصدقاء
              متاحين (بعد فتح الدردشة) يصلهم الطلب أولًا. يمكنك الإبلاغ عن الطرف
              الآخر أو حظره في أي وقت، وإيقاف الميزة من الإعدادات.
            </li>
            <li>
              <strong>ميزة "التحدي":</strong> متاحة للاعبين المسجّلين. تظهر لخصمك فقط
              اسم الحلبة واسمك المستعار وصورتك، والمحادثة الصوتية (اختيارية، 5 مرات يوميًا)
              مباشرة بين الجهازين دون تسجيل. نتيجة التحدي لا تدخل في الجائزة الأسبوعية، ويُعلَّم
              اللغز المتحدّى عليه خارج الترتيب لمن لم يجاوبه من قبل. الإعلان المكافئ مطلوب قبل بدء التحدي أو قبوله.
            </li>
          </ul>
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
