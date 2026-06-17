import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMyChatProfile } from "@/hooks/useChatProfile";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

export default function RequireCompletion({ children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading } = useMyChatProfile();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  console.log("[RequireCompletion]", {
    userId: user?.id,
    completed: profile?.completed,
    username: profile?.username,
    is_muted_until: profile?.is_muted_until,
    is_suspended_until: profile?.is_suspended_until,
  });
  if (!user) {
    console.warn("[RequireCompletion] no user → /");
    return <Navigate to="/" replace />;
  }
  if (!profile?.completed) {
    console.warn("[RequireCompletion] profile.completed=false → /");
    return <Navigate to="/" replace />;
  }

  const suspended = profile.is_suspended_until && new Date(profile.is_suspended_until) > new Date();
  if (suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
        <div className="card-horror p-6 max-w-md text-center">
          <h2 className="font-horror text-2xl text-destructive mb-3">حسابك موقوف مؤقتاً</h2>
          <p className="font-typewriter text-sm text-foreground/80">
            تم إيقاف حسابك من الدردشة بسبب تكرار البلاغات.
            يمكنك العودة بعد: {new Date(profile.is_suspended_until!).toLocaleString("ar-EG")}
          </p>
        </div>
      </div>
    );
  }

  if (!profile.username) {
    return <Navigate to="/chat/setup" replace />;
  }

  return <>{children}</>;
}
