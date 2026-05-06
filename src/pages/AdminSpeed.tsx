import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowUpDown, Trophy } from "lucide-react";

interface Row {
  id: string;
  full_name: string | null;
  phone: string | null;
  payment_phone: string | null;
  email: string | null;
  total_correct: number;
  total_questions: number;
  total_points: number;
  time_bonus: number;
  payment_status: string | null;
  created_at: string;
}

const AdminSpeed = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/");
      return;
    }
    (async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roleData);
      if (!roleData) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("competition_scores")
        .select("id, full_name, phone, payment_phone, email, total_correct, total_questions, total_points, time_bonus, payment_status, created_at")
        .order("time_bonus", { ascending: false });
      setRows((data as Row[]) || []);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const sorted = [...rows].sort((a, b) =>
    sortDesc ? b.time_bonus - a.time_bonus : a.time_bonus - b.time_bonus
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-horror-gradient flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-horror-gradient flex items-center justify-center" dir="rtl">
        <div className="card-horror p-6 max-w-md text-center">
          <h2 className="font-horror text-2xl text-red-400 mb-2">غير مصرح</h2>
          <p className="font-typewriter text-sm text-muted-foreground">
            هذه الصفحة متاحة لمالك التطبيق فقط.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-horror-gradient p-4" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-horror text-2xl text-primary flex items-center gap-2">
            <Trophy className="w-6 h-6" /> ترتيب أسرع المتسابقين
          </h1>
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="flex items-center gap-2 bg-secondary/60 border border-primary/30 hover:border-primary rounded-lg px-3 py-2 font-typewriter text-sm text-foreground"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortDesc ? "الأسرع أولاً" : "الأبطأ أولاً"}
          </button>
        </div>

        <div className="card-horror p-2 overflow-x-auto">
          <table className="w-full text-right font-typewriter text-sm">
            <thead className="text-primary border-b border-primary/30">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">الاسم</th>
                <th className="p-2">الهاتف</th>
                <th className="p-2">النتيجة</th>
                <th className="p-2">النقاط</th>
                <th className="p-2 text-yellow-400">السرعة</th>
                <th className="p-2">الدفع</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    لا توجد بيانات بعد.
                  </td>
                </tr>
              )}
              {sorted.map((r, i) => (
                <tr key={r.id} className="border-b border-primary/10 hover:bg-secondary/30">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 text-foreground">{r.full_name || "—"}</td>
                  <td className="p-2 text-foreground/80" dir="ltr">{r.payment_phone || r.phone || "—"}</td>
                  <td className="p-2 text-foreground">{r.total_correct}/{r.total_questions}</td>
                  <td className="p-2 text-foreground">{r.total_points}</td>
                  <td className="p-2 text-yellow-400 font-bold">+{r.time_bonus}</td>
                  <td className="p-2 text-foreground/80">{r.payment_status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminSpeed;
