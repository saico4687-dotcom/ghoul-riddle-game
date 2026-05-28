import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowRight, LogOut, Trash2, User as UserIcon, Mail } from "lucide-react";

const CONTACT_EMAIL = "support@rebh-app.com";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    toast({ title: "تم تسجيل الخروج بنجاح" });
    navigate("/", { replace: true });
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await supabase.auth.signOut();
      toast({
        title: "تم حذف حسابك",
        description: "تم حذف جميع بياناتك نهائيًا.",
      });
      navigate("/", { replace: true });
    } catch (e: any) {
      toast({ title: "حدث خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-horror text-2xl text-primary">حذف الحساب</h1>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-typewriter"
          >
            <span>الرئيسية</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 font-typewriter space-y-6">
        {checking ? (
          <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>
        ) : !user ? (
          <div className="rounded-lg border border-border bg-card/60 p-6 space-y-4 text-center">
            <h2 className="text-xl font-semibold">يلزم تسجيل الدخول</h2>
            <p className="text-sm text-muted-foreground">
              لحذف حسابك بشكل آمن، يجب أن تكون مسجّلاً للدخول أولاً.
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              الذهاب إلى تسجيل الدخول
            </Link>
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-border bg-card/60 p-6 space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-primary" />
                معلومات حسابك
              </h2>
              <div className="flex items-center gap-4">
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="avatar"
                    className="w-14 h-14 rounded-full border border-border"
                  />
                )}
                <div className="space-y-1">
                  <p className="font-semibold">
                    {user.user_metadata?.full_name || user.user_metadata?.name || "مستخدم"}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card/60 p-6 space-y-3">
              <h2 className="text-xl font-semibold">تسجيل الخروج</h2>
              <p className="text-sm text-muted-foreground">
                سيتم تسجيل خروجك من التطبيق على هذا الجهاز.
              </p>
              <Button
                onClick={handleLogout}
                disabled={signingOut}
                variant="outline"
                className="w-full gap-2"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? "جارٍ تسجيل الخروج..." : "Log Out"}
              </Button>
            </section>

            <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-3">
              <h2 className="text-xl font-semibold text-destructive">منطقة الخطر</h2>
              <p className="text-sm">
                سيؤدي حذف حسابك إلى إزالة جميع بياناتك نهائيًا، بما في ذلك:
              </p>
              <ul className="list-disc pr-6 space-y-1 text-sm text-muted-foreground">
                <li>بيانات الحساب والملف الشخصي.</li>
                <li>نتائج الألغاز وتقدمك المحفوظ.</li>
                <li>أي بيانات إضافية مرتبطة باستخدامك للتطبيق.</li>
              </ul>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2" disabled={loading}>
                    <Trash2 className="w-4 h-4" />
                    {loading ? "جارٍ الحذف..." : "Delete My Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف حسابك؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      هذا الإجراء لا يمكن التراجع عنه. سيتم حذف حسابك ({user.email}) وجميع
                      بياناتك نهائيًا من قاعدة البيانات.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      نعم، احذف حسابي
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <p className="text-xs text-muted-foreground pt-2">
                للاستفسار:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
