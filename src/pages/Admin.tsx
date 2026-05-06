import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Check, X, Loader2, RefreshCw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Score {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  payment_phone: string | null;
  total_points: number;
  total_correct: number;
  time_bonus: number;
  payment_status: string | null;
  payment_proof_url: string | null;
  paid: boolean;
  entered_draw: boolean;
  created_at: string;
  transaction_number: string | null;
  payment_date: string | null;
  payment_time: string | null;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "pending"
  );
  const [actingId, setActingId] = useState<string | null>(null);

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

  const fetchScores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("competition_scores")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("فشل تحميل البيانات");
    else setScores((data as Score[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchScores();
  }, [isAdmin]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    setActingId(id);
    const { error } = await supabase
      .from("competition_scores")
      .update({
        payment_status: status,
        paid: status === "approved",
        entered_draw: status === "approved",
      })
      .eq("id", id);
    if (error) toast.error("تعذّر تحديث الحالة");
    else {
      toast.success(status === "approved" ? "تم القبول" : "تم الرفض");
      await fetchScores();
    }
    setActingId(null);
  };

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

  const filtered = scores.filter((s) => {
    if (filter === "all") return true;
    if (filter === "pending") return (s.payment_status ?? "pending") === "pending";
    if (filter === "approved") return s.payment_status === "approved";
    if (filter === "rejected") return s.payment_status === "rejected";
    return true;
  });

  const counts = {
    all: scores.length,
    pending: scores.filter((s) => (s.payment_status ?? "pending") === "pending").length,
    approved: scores.filter((s) => s.payment_status === "approved").length,
    rejected: scores.filter((s) => s.payment_status === "rejected").length,
  };

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

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6 font-typewriter">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card/40 border-border/40 hover:border-primary/40"
              }`}
            >
              {f === "pending" && `قيد المراجعة (${counts.pending})`}
              {f === "approved" && `مقبول (${counts.approved})`}
              {f === "rejected" && `مرفوض (${counts.rejected})`}
              {f === "all" && `الكل (${counts.all})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground font-typewriter py-20">
            لا توجد سجلات في هذا التصنيف.
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((s) => {
              const status = s.payment_status ?? "pending";
              const speed = s.time_bonus;
              return (
                <div
                  key={s.id}
                  className="bg-card/60 border border-border/40 rounded-xl p-4 backdrop-blur-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-horror text-lg text-foreground">
                        {s.full_name || "مستخدم"}
                      </h3>
                      <p className="text-xs text-muted-foreground font-typewriter mt-1">
                        {s.email || "—"} · {s.phone || "—"}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-typewriter ${
                        status === "approved"
                          ? "bg-green-500/20 text-green-400 border border-green-500/40"
                          : status === "rejected"
                          ? "bg-red-500/20 text-red-400 border border-red-500/40"
                          : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                      }`}
                    >
                      {status === "approved"
                        ? "مقبول"
                        : status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-typewriter mb-3">
                    <Field label="النقاط" value={s.total_points} />
                    <Field label="الإجابات الصحيحة" value={s.total_correct} />
                    <Field
                      label="السرعة (مالك فقط)"
                      value={speed}
                      highlight
                    />
                    <Field
                      label="هاتف الدفع"
                      value={s.payment_phone || "—"}
                    />
                    <Field
                      label="رقم العملية"
                      value={s.transaction_number || "—"}
                    />
                    <Field
                      label="تاريخ الدفع"
                      value={s.payment_date || "—"}
                    />
                    <Field
                      label="وقت الدفع"
                      value={s.payment_time || "—"}
                    />
                    <Field
                      label="تاريخ التسجيل"
                      value={new Date(s.created_at).toLocaleString("ar-EG")}
                    />
                  </div>

                  {s.payment_proof_url && (
                    <a
                      href={s.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-3"
                    >
                      <Eye className="w-4 h-4" />
                      عرض إثبات الدفع
                    </a>
                  )}

                  {status === "pending" && (
                    <div className="flex gap-2 pt-3 border-t border-border/40">
                      <button
                        disabled={actingId === s.id}
                        onClick={() => updateStatus(s.id, "approved")}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-white transition-colors disabled:opacity-50 font-typewriter"
                      >
                        <Check className="w-4 h-4" /> قبول
                      </button>
                      <button
                        disabled={actingId === s.id}
                        onClick={() => updateStatus(s.id, "rejected")}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors disabled:opacity-50 font-typewriter"
                      >
                        <X className="w-4 h-4" /> رفض
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
