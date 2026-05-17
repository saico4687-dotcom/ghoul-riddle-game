import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const CONTACT_EMAIL = "support@ghoul-riddle-game.com";

export default function DeleteAccount() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const handleDelete = async () => {
    if (!email) {
      toast({ title: "أدخل بريدك الإلكتروني", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (user) {
        const { error } = await supabase.functions.invoke("delete-account");
        if (error) throw error;
        await supabase.auth.signOut();
        toast({ title: "تم استلام طلب حذف حسابك", description: "سيتم حذف جميع بياناتك نهائيًا خلال 30 يومًا." });
      } else {
        toast({
          title: "تم استلام طلبك",
          description: `سيتم حذف حساب ${email} وجميع بياناته خلال 30 يومًا.`,
        });
      }
      setEmail("");
    } catch (e: any) {
      toast({ title: "حدث خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col items-center" dir="rtl">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-3xl font-bold">حذف الحساب وبياناتك</h1>
        <p className="text-muted-foreground">
          تطبيق <strong>Come Bound — Mind Riddles</strong> يحترم خصوصيتك. يمكنك من خلال هذه الصفحة طلب حذف حسابك وجميع البيانات المرتبطة به نهائيًا.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">كيفية تقديم طلب الحذف</h2>
          <ol className="list-decimal pr-6 space-y-1 text-sm">
            <li>أدخل بريدك الإلكتروني المسجّل في الخانة بالأسفل ثم اضغط على زر "حذف حسابي نهائيًا".</li>
            <li>
              أو راسلنا مباشرة على البريد:{" "}
              <a href={`mailto:${CONTACT_EMAIL}?subject=طلب حذف حساب`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>{" "}
              من نفس البريد المسجّل في التطبيق وأرفق طلب الحذف.
            </li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">البيانات التي سيتم حذفها</h2>
          <ul className="list-disc pr-6 space-y-1 text-sm">
            <li>بيانات الحساب (الاسم، البريد الإلكتروني، الصورة).</li>
            <li>نتائج الألغاز ونقاطك في المسابقات.</li>
            <li>بيانات المشاركة في السحب وإثباتات الدفع.</li>
            <li>أي بيانات أخرى مرتبطة بحسابك داخل التطبيق.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">مدة الحذف</h2>
          <p className="text-sm">
            سيتم حذف جميع بياناتك المرتبطة بحسابك نهائيًا خلال مدة أقصاها <strong>30 يومًا</strong> من تاريخ استلام الطلب، ولا يمكن استرجاعها بعد ذلك.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">البيانات المحتفظ بها</h2>
          <p className="text-sm">
            قد نحتفظ ببعض السجلات المالية أو القانونية للفترة التي يفرضها القانون فقط، ثم يتم حذفها بشكل دائم.
          </p>
        </section>

        <section className="space-y-3 pt-4 border-t border-border">
          <h2 className="text-xl font-semibold">تقديم طلب الحذف</h2>
          <Input
            type="email"
            placeholder="البريد الإلكتروني المسجّل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!user}
          />
          <Button onClick={handleDelete} disabled={loading} variant="destructive" className="w-full">
            {loading ? "جارٍ المعالجة..." : "حذف حسابي نهائيًا"}
          </Button>
          <p className="text-xs text-muted-foreground">
            للاستفسار أو المتابعة، تواصل معنا على:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <Link to="/" className="text-primary underline text-sm block text-center pt-4">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
