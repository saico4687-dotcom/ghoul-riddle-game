import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Shield, FileText, Mail, Info, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CONTACT_EMAIL = "support@rebh-app.com";

const Settings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("تم تسجيل الخروج");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-primary">الإعدادات</h1>
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
                  <p className="text-xs text-muted-foreground">قراءة داخل التطبيق</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>

            <Link
              to="/terms"
              className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border/40 bg-background/40 hover:bg-background/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div className="text-right">
                  <p className="text-base text-foreground">شروط الاستخدام</p>
                  <p className="text-xs text-muted-foreground">قواعد استخدام التطبيق</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </Link>
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
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="font-horror text-lg text-primary">عن التطبيق</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            ربح — تطبيق ألغاز عربي ممتع يحفّز العقل وينمّي مهارات التفكير.
            حلّ الألغاز، اجمع النقاط، وارتقِ بترتيبك.
          </p>
          <p className="text-xs text-muted-foreground/70" dir="ltr">
            Version 1.0.0
          </p>
        </section>

        {user && (
          <section className="card-horror p-5">
            <h2 className="font-horror text-lg text-primary mb-2">الحساب</h2>
            <p className="text-xs text-muted-foreground mb-4" dir="ltr">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 font-typewriter"
            >
              <LogOut className="w-5 h-5" />
              <span>تسجيل الخروج</span>
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

export default Settings;
