import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, Users, CheckCircle, Clock, XCircle, Eye, ArrowRight, LogOut } from "lucide-react";

interface CompetitionEntry {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_phone: string | null;
  total_points: number;
  total_correct: number;
  total_questions: number;
  time_bonus: number;
  entered_draw: boolean;
  paid: boolean;
  payment_status: string | null;
  payment_proof_url: string | null;
  payment_date: string | null;
  payment_time: string | null;
  created_at: string;
}

const AdminDashboard = ({ onBack }: { onBack: () => void }) => {
  const { user, signOut } = useAuth();
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<CompetitionEntry | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewing" | "confirmed">("all");

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("competition_scores")
      .select("*")
      .order("created_at", { ascending: false });
    
    setEntries((data as any[]) || []);
    setLoading(false);
  };

  const handleConfirmPayment = async (userId: string) => {
    await supabase
      .from("competition_scores")
      .update({ payment_status: "تم الدفع", paid: true, updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    
    setSelectedEntry(null);
    fetchEntries();
  };

  const handleRejectPayment = async (userId: string) => {
    await supabase
      .from("competition_scores")
      .update({ payment_status: "مرفوض", updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    
    setSelectedEntry(null);
    fetchEntries();
  };

  const filteredEntries = entries.filter((e) => {
    if (filter === "all") return true;
    if (filter === "pending") return !e.payment_status || e.payment_status === "pending";
    if (filter === "reviewing") return e.payment_status === "قيد المراجعة";
    if (filter === "confirmed") return e.payment_status === "تم الدفع";
    return true;
  });

  const stats = {
    total: entries.length,
    reviewing: entries.filter((e) => e.payment_status === "قيد المراجعة").length,
    confirmed: entries.filter((e) => e.payment_status === "تم الدفع").length,
    pending: entries.filter((e) => !e.payment_status || e.payment_status === "pending").length,
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "تم الدفع":
        return <span className="px-2 py-1 rounded text-xs bg-green-900/60 text-green-300 border border-green-500">تم الدفع ✓</span>;
      case "قيد المراجعة":
        return <span className="px-2 py-1 rounded text-xs bg-yellow-900/60 text-yellow-300 border border-yellow-500">قيد المراجعة</span>;
      case "مرفوض":
        return <span className="px-2 py-1 rounded text-xs bg-red-900/60 text-red-300 border border-red-500">مرفوض</span>;
      default:
        return <span className="px-2 py-1 rounded text-xs bg-secondary text-muted-foreground border border-border">لم يدفع</span>;
    }
  };

  // Detail view
  if (selectedEntry) {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden" dir="rtl">
        <div className="vignette" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
          <button onClick={() => setSelectedEntry(null)} className="flex items-center gap-2 font-typewriter text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowRight className="w-4 h-4" /> العودة للقائمة
          </button>

          <div className="card-horror p-6 space-y-4">
            <h2 className="font-horror text-2xl text-primary">{selectedEntry.full_name || "بدون اسم"}</h2>
            
            <div className="grid grid-cols-2 gap-4 font-typewriter text-sm">
              <div><span className="text-muted-foreground">البريد:</span> <span className="text-foreground">{selectedEntry.email || "-"}</span></div>
              <div><span className="text-muted-foreground">الهاتف:</span> <span className="text-foreground">{selectedEntry.phone || "-"}</span></div>
              <div><span className="text-muted-foreground">العنوان:</span> <span className="text-foreground">{selectedEntry.address || "-"}</span></div>
              <div><span className="text-muted-foreground">هاتف الدفع:</span> <span className="text-foreground">{selectedEntry.payment_phone || "-"}</span></div>
              <div><span className="text-muted-foreground">النقاط:</span> <span className="text-foreground">{selectedEntry.total_points}</span></div>
              <div><span className="text-muted-foreground">الإجابات الصحيحة:</span> <span className="text-foreground">{selectedEntry.total_correct}/{selectedEntry.total_questions}</span></div>
              <div><span className="text-muted-foreground">تاريخ الدفع:</span> <span className="text-foreground">{selectedEntry.payment_date || "-"}</span></div>
              <div><span className="text-muted-foreground">وقت الدفع:</span> <span className="text-foreground">{selectedEntry.payment_time || "-"}</span></div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-typewriter text-sm text-muted-foreground">الحالة:</span>
              {getStatusBadge(selectedEntry.payment_status)}
            </div>

            {selectedEntry.payment_proof_url && (
              <div>
                <p className="font-typewriter text-sm text-muted-foreground mb-2">صورة إثبات الدفع:</p>
                <img src={selectedEntry.payment_proof_url} alt="payment proof" className="max-w-full rounded-lg border border-primary/30" />
              </div>
            )}

            {selectedEntry.payment_status === "قيد المراجعة" && (
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleConfirmPayment(selectedEntry.user_id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-800 hover:bg-green-700 text-green-100 rounded-lg font-typewriter text-sm transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> تأكيد الدفع
                </button>
                <button
                  onClick={() => handleRejectPayment(selectedEntry.user_id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-800 hover:bg-red-700 text-red-100 rounded-lg font-typewriter text-sm transition-colors"
                >
                  <XCircle className="w-4 h-4" /> رفض
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden" dir="rtl">
      <div className="vignette" />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-horror text-3xl text-primary">لوحة التحكم</h1>
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
              العودة للعبة
            </button>
            <button onClick={signOut} className="flex items-center gap-1 font-typewriter text-sm text-red-400 hover:text-red-300 transition-colors">
              <LogOut className="w-4 h-4" /> خروج
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-horror p-4 text-center">
            <Users className="w-6 h-6 mx-auto text-primary mb-2" />
            <div className="font-horror text-2xl text-primary">{stats.total}</div>
            <div className="font-typewriter text-xs text-muted-foreground">إجمالي المشتركين</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-horror p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-yellow-400 mb-2" />
            <div className="font-horror text-2xl text-yellow-400">{stats.reviewing}</div>
            <div className="font-typewriter text-xs text-muted-foreground">قيد المراجعة</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-horror p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-green-400 mb-2" />
            <div className="font-horror text-2xl text-green-400">{stats.confirmed}</div>
            <div className="font-typewriter text-xs text-muted-foreground">تم الدفع</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-4 text-center">
            <Trophy className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <div className="font-horror text-2xl text-muted-foreground">{stats.pending}</div>
            <div className="font-typewriter text-xs text-muted-foreground">لم يدفع</div>
          </motion.div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["all", "reviewing", "confirmed", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-typewriter text-xs transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "الكل" : f === "reviewing" ? "قيد المراجعة" : f === "confirmed" ? "تم الدفع" : "لم يدفع"}
            </button>
          ))}
        </div>

        {/* Entries list */}
        {loading ? (
          <p className="font-typewriter text-muted-foreground text-center py-8">جاري التحميل...</p>
        ) : filteredEntries.length === 0 ? (
          <p className="font-typewriter text-muted-foreground text-center py-8">لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card-horror p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedEntry(entry)}
              >
                <div className="flex-1">
                  <div className="font-typewriter text-sm text-foreground">{entry.full_name || entry.email || "مستخدم"}</div>
                  <div className="font-typewriter text-xs text-muted-foreground mt-1">
                    النقاط: {entry.total_points} | الصحيحة: {entry.total_correct}/{entry.total_questions}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(entry.payment_status)}
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
