import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Mail, Lock, LogIn, UserPlus, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { clearStaleAuth } from "@/lib/clearStaleAuth";
import { isNativePlatform } from "@/lib/isNative";
import { startNativeGoogleSignIn } from "@/lib/nativeGoogleAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";


interface EmailAuthScreenProps {
  onBack: () => void;
}

const EmailAuthScreen = ({ onBack }: EmailAuthScreenProps) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "بيانات ناقصة", description: "ادخل البريد وكلمة السر", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name, name },
          },
        });
        if (error) throw error;
        toast({
          title: "تم إنشاء الحساب",
          description: "افتح بريدك لتأكيد الحساب ثم سجّل الدخول",
        });
        setMode("login");
      } else {
        // Wipe any stale/broken session before logging in fresh
        await clearStaleAuth();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "أهلاً بعودتك", description: "تم تسجيل الدخول" });
      }
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err?.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      // Wipe any stale/broken session before launching Google OAuth
      await clearStaleAuth();

      if (isNativePlatform()) {
        await startNativeGoogleSignIn();
        return;
      }

      const result = await lovable.auth.signInWithOAuth("google", {
  redirect_uri: "https://ghoul-riddle-game.lovable.app/auth/callback",
});
      if (result.error) {
        toast({ title: "تعذّر تسجيل دخول Google", description: String(result.error), variant: "destructive" });
        setLoading(false);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
      <div className="vignette" />
      <div className="fog-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 card-horror p-6 max-w-md w-full mx-4"
      >
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 mx-auto text-primary flicker mb-3" />
          <h2 className="font-horror text-3xl text-primary">
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <Input
              type="text"
              placeholder="الاسم بالكامل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background/40 text-right"
            />
          )}
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/40 pr-10 text-right"
              dir="ltr"
            />
          </div>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="كلمة السر (6 أحرف على الأقل)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/40 pr-10 text-right"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-typewriter text-lg rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : mode === "login" ? (
              <><LogIn className="w-5 h-5" /><span>دخول</span></>
            ) : (
              <><UserPlus className="w-5 h-5" /><span>إنشاء الحساب</span></>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="block mx-auto mt-3 text-sm text-muted-foreground hover:text-foreground font-typewriter"
        >
          {mode === "login" ? "ليس لديك حساب؟ أنشئ حساب" : "لديك حساب؟ سجّل الدخول"}
        </button>

        <div className="my-4 flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">أو</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-foreground/90 hover:bg-foreground text-background font-typewriter rounded-lg transition-all disabled:opacity-50"
        >
          <LogIn className="w-4 h-4" />
          <span>المتابعة بـ Google</span>
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground font-typewriter">
          <Shield className="w-4 h-4" />
          <span>بالاستمرار أنت توافق على</span>
          <Link to="/privacy" className="text-primary hover:underline underline-offset-4">
            سياسة الخصوصية
          </Link>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-2 mx-auto mt-4 font-typewriter text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للقائمة الرئيسية</span>
        </button>
      </motion.div>
    </div>
  );
};

export default EmailAuthScreen;
