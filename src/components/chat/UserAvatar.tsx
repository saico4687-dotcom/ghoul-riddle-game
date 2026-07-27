import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarSignedUrl } from "@/lib/chat/queries";
import { cn } from "@/lib/utils";

interface Props {
  url?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  // true لو صاحب الصورة عنده مكافأة "دردشة بدون إعلانات" نشطة —
  // بيظهر طوق ذهبي حوالين الصورة، ويبان لأي مستخدم تاني يشوفها.
  adFree?: boolean;
  className?: string;
}

const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14", xl: "h-24 w-24" };

export default function UserAvatar({ url, username, size = "md", online, adFree, className }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  const initial = (username ?? "?").charAt(0).toUpperCase();

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setResolved(null);
      return;
    }
    // روابط جاهزة للعرض مباشرة (http أو blob من URL.createObjectURL
    // للمعاينة المحلية قبل الرفع) — من غير ما نحاول نعاملها كمسار
    // تخزين في Supabase.
    if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) {
      setResolved(url);
      return;
    }
    avatarSignedUrl(url).then((u) => {
      if (!cancelled) setResolved(u);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar
        className={cn(
          sizes[size],
          adFree
            ? "border-4 border-yellow-400 shadow-[0_0_10px_2px_rgba(250,204,21,0.65)]"
            : "border-2 border-primary/30"
        )}
      >
        {resolved && <AvatarImage src={resolved} alt={username ?? ""} />}
        <AvatarFallback className="bg-primary/20 text-primary font-horror">{initial}</AvatarFallback>
      </Avatar>
      {typeof online === "boolean" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-background",
            online ? "bg-emerald-500" : "bg-muted-foreground"
          )}
        />
      )}
    </div>
  );
}
