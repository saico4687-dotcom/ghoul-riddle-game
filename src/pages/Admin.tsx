import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Loader2, RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminModeration from "@/components/AdminModeration";


interface Score {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  total_points: number;
  total_correct: number;
  total_questions: number;
  time_bonus: number;
  entered_draw: boolean;
  created_at: string;
}

interface WeeklyWinner {
  user_id: string;
  riddles_solved: number;
  fastest_answer_ms: number;
  full_name?: string | null;
  email?: string | null;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [weeklyWinner, setWeeklyWinner] = useState<WeeklyWinner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const fetchWeeklyWinner = async () => {
    // Start of current ISO week (Monday 00:00 local)
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const diff = (day + 6) % 7; // days since Monday
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase.rpc("get_weekly_winner", {
      p_week_start: weekStart.toISOString(),
    });

    if (error || !data || data.length === 0) {
      setWeeklyWinner(null);
      return;
    }

    const winner = data[0] as {
      user_id: string;
      riddles_solved: number;
      fastest_answer_ms: number;
    };

    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id, full_name, name, email")
      .eq("user_id", winner.user_id)
      .maybeSingle();

    setWeeklyWinner({
      ...winner,
      full_name: (prof as any)?.full_name || (prof as any)?.name || null,
      email: prof?.email || null,
    });
  };

  const fetchScores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("competition_scores")
      .select("*")
      .order("total_points", { ascending: false })
      .order("time_bonus", { ascending: false });
    if (error) toast.error("فشل تحميل البيانات");
    else setScores((data as Score[]) ?? []);
    await fetchWeeklyWinner();
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchScores();
  }, [isAdmin]);

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center"
      >
        <h1 className="font-horror text-3xl text-blood mb-3">غير مصرّح</h1>
        <p className="font-typewriter text-muted-foreground mb-6">
          هذه الصفحة مخصصة لمالكي التطبيق فقط.
        </p>
        <Link to="/" className="text-primary hover:underline font-typewriter">
          العودة إلى الرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <h1 className="font-horror text-2xl md:text-3xl text-blood">
            لوحة المالك
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchScores}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث</span>
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-typewriter"
            >
              <span>الرئيسية</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <Tabs defaultValue="scores">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="scores">النتائج</TabsTrigger>
            <TabsTrigger value="moderation">الإشراف على الدردشة</TabsTrigger>
          </TabsList>

          <TabsContent value="moderation" className="mt-6">
            <AdminModeration adminId={user!.id} />
          </TabsContent>

          <TabsContent value="scores" className="mt-6 space-y-8">
            <section className="bg-card/60 border border-primary/30 rounded-xl p-4 backdrop-blur-sm">
              <h2 className="font-horror text-xl text-blood mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                فائز الأسبوع
              </h2>
              {!weeklyWinner ? (
                <p className="text-sm text-muted-foreground font-typewriter">
                  لسه محدش سجّل إجابات الأسبوع ده.
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3 bg-background/40 rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-foreground font-typewriter truncate">
                      {weeklyWinner.full_name || "مستخدم"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {weeklyWinner.email || "—"} · حل {weeklyWinner.riddles_solved} لغز
                    </p>
                  </div>
                  <span className="text-blood font-bold whitespace-nowrap font-typewriter">
                    {(weeklyWinner.fastest_answer_ms / 1000).toFixed(2)} ث
                  </span>
                </div>
              )}
            </section>

            <p className="font-typewriter text-muted-foreground text-sm">
              إجمالي المشاركين: {scores.length}
            </p>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : scores.length === 0 ? (
              <p className="text-center text-muted-foreground font-typewriter py-20">
                لا توجد نتائج بعد.
              </p>
            ) : (
              <div className="space-y-4">
                {scores.map((s, idx) => (
                  <div
                    key={s.id}
                    className="bg-card/60 border border-border/40 rounded-xl p-4 backdrop-blur-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-horror text-lg text-foreground">
                          #{idx + 1} — {s.full_name || "مستخدم"}
                        </h3>
                        <p className="text-xs text-muted-foreground font-typewriter mt-1">
                          {s.email || "—"} · {s.phone || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-typewriter">
                      <Field label="النقاط" value={s.total_points} highlight />
                      <Field label="إجابات صحيحة" value={`${s.total_correct}/${s.total_questions}`} />
                      <Field label="السرعة (مالك فقط)" value={s.time_bonus} highlight />
                      <Field
                        label="تاريخ التسجيل"
                        value={new Date(s.created_at).toLocaleString("ar-EG")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};


const Field = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) => (
  <div>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p
      className={`text-sm ${
        highlight ? "text-blood font-bold" : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

export default Admin;
