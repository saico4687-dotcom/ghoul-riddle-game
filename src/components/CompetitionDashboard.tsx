import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HorrorButton from "@/components/HorrorButton";

interface CompetitionDashboardProps {
  onStartPuzzles: () => void;
  onEnterDraw: () => void;
}

const CompetitionDashboard = ({ onStartPuzzles, onEnterDraw }: CompetitionDashboardProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAvatarUrl(user.user_metadata?.avatar_url || null);
        setUserName(user.user_metadata?.full_name || user.email || "");

        // Load score
        const { data } = await supabase
          .from("competition_scores")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setTotalPoints(data.total_points);
          setTotalCorrect(data.total_correct);
          setTotalQuestions(data.total_questions);
        }
      }
    };

    loadUserData();

    // Realtime subscription for score updates
    const channel = supabase
      .channel("competition-score-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_scores",
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData) {
            setTotalPoints(newData.total_points ?? 0);
            setTotalCorrect(newData.total_correct ?? 0);
            setTotalQuestions(newData.total_questions ?? 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-horror-gradient flex flex-col items-center px-4 py-8" dir="rtl">
      <div className="vignette" />

      {/* User Profile */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center z-10 mb-8"
      >
        <div className="w-24 h-24 rounded-full border-4 border-primary overflow-hidden shadow-lg shadow-primary/40 mb-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <span className="font-horror text-3xl text-primary">
                {userName.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <h1 className="font-horror text-3xl text-primary mb-1">لوحة المسابقة</h1>
        <p className="font-typewriter text-muted-foreground text-sm">{userName}</p>
      </motion.div>

      {/* Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-sm card-horror p-6 mb-6 z-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="font-horror text-xl text-primary">نتيجتك الآن</h2>
        </div>
        <div className="text-center">
          <motion.p
            key={totalPoints}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="font-horror text-6xl text-primary pulse-blood"
          >
            {totalPoints}
          </motion.p>
          <p className="font-typewriter text-muted-foreground text-sm mt-2">نقطة</p>
          <div className="flex justify-center gap-6 mt-4 text-sm font-typewriter">
            <div className="text-center">
              <p className="text-foreground text-lg">{totalCorrect}</p>
              <p className="text-muted-foreground">إجابات صحيحة</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-foreground text-lg">{totalQuestions}</p>
              <p className="text-muted-foreground">أسئلة</p>
            </div>
          </div>
        </div>

      </motion.div>

      {/* Draw & Start Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="w-full max-w-sm card-horror p-6 z-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <Ticket className="w-6 h-6 text-primary" />
          <h2 className="font-horror text-xl text-primary">الدخول في سحب المسابقة</h2>
        </div>
        <p className="font-typewriter text-muted-foreground text-sm mb-4">
          ادخل السحب للفوز بجوائز مذهلة!
        </p>
        <HorrorButton onClick={onEnterDraw} className="w-full">
          🎮 ابدأ الألغاز وادخل في السحب
        </HorrorButton>
      </motion.div>
    </div>
  );
};

export default CompetitionDashboard;
