import { Link } from "react-router-dom";
import { ArrowRight, Shield, Download, Mail } from "lucide-react";

const CONTACT_EMAIL = "support@ghoul-riddle-game.com";

const Settings = () => {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-blood">الإعدادات</h1>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-typewriter"
          >
            <span>الرئيسية</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4 font-typewriter">
        <section className="card-horror p-5">
          <h2 className="font-horror text-lg text-primary mb-4">القانونية والخصوصية</h2>

          <div className="space-y-3">
            <Link
              to="/privacy"
              className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div className="text-right">
                  <p className="text-base text-foreground">سياسة الخصوصية</p>
                  <p className="text-xs text-muted-foreground">عرض داخل التطبيق</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            <a
              href="/privacy-policy.pdf"
              download
              className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-primary" />
                <div className="text-right">
                  <p className="text-base text-foreground">تحميل سياسة الخصوصية (PDF)</p>
                  <p className="text-xs text-muted-foreground">نسخة قابلة للحفظ والمشاركة</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        </section>

        <section className="card-horror p-5">
          <h2 className="font-horror text-lg text-primary mb-4">الدعم والتواصل</h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div className="text-right">
                <p className="text-base text-foreground">راسلنا</p>
                <p className="text-xs text-muted-foreground" dir="ltr">{CONTACT_EMAIL}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </a>
        </section>

        <section className="card-horror p-5">
          <h2 className="font-horror text-lg text-primary mb-2">عن التطبيق</h2>
          <p className="text-sm text-muted-foreground">
            ألغاز الرعب — تطبيق ألغاز عربي يجمع بين المتعة والتحدي.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Settings;
