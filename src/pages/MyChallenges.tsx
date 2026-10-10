import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import UserAvatar from "@/components/chat/UserAvatar";
import HorrorButton from "@/components/HorrorButton";
import { useAuth } from "@/hooks/useAuth";
import { challengeApi } from "@/lib/challengeApi";

// "تحدياتك": النتيجة الإجمالية مع كل خصم (مثلًا 1:2) واسم المتصدر.
type Row = NonNullable<Awaited<ReturnType<typeof challengeApi.history>>["data"]>["list"][number];

export default function MyChallenges() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    void challengeApi.history().then((r) => {
      if (r.ok) setRows(r.data.list);
      else setFailed(true);
    });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-horror-gradient px-4 py-6" dir="rtl">
      <div className="max-w-xl mx-auto space-y-4">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1 font-typewriter text-sm text-muted-foreground">
          <ArrowRight className="w-4 h-4" /> رجوع
        </button>
        <h1 className="text-center font-horror text-4xl text-primary">🏆 تحدياتك</h1>

        {rows === null && !failed && <p className="text-center font-typewriter text-muted-foreground">جاري التحميل...</p>}
        {failed && <p className="text-center font-typewriter text-red-300">تعذّر تحميل التحديات. حاول تاني.</p>}

        {rows && rows.length === 0 && (
          <div className="card-horror p-6 text-center space-y-3">
            <p className="font-typewriter text-foreground">لسه ما لعبتش أي تحدي.</p>
            <HorrorButton onClick={() => navigate("/arena")}>🥊 ادخل الحلبة</HorrorButton>
          </div>
        )}

        {rows?.map((r) => (
          <div key={r.opponentId} className="card-horror p-4 flex items-center gap-3">
            <UserAvatar url={r.avatarUrl} username={r.name} size="lg" />
            <div className="flex-1 min-w-0 text-right">
              <p className="font-horror text-lg text-foreground truncate">{r.name}</p>
              <p className="font-typewriter text-xs text-muted-foreground">
                {r.rounds} جولة{r.draws > 0 ? ` — تعادل ${r.draws}` : ""}
              </p>
              <p className="font-typewriter text-sm text-primary">
                {r.leader === "draw" ? "متعادلين" : `المتصدر: ${r.leaderName}`}
              </p>
            </div>
            <p className="font-horror text-3xl text-foreground tracking-wider" dir="ltr">
              {r.meWins}:{r.otherWins}
            </p>
          </div>
        ))}
        {rows && rows.length > 0 && (
          <p className="text-center font-typewriter text-xs text-muted-foreground">النتيجة من وجهة نظرك: (أنت : خصمك)</p>
        )}
      </div>
    </div>
  );
}
