import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarPublicUrl } from "@/lib/chat/queries";
import { cn } from "@/lib/utils";

interface Props {
  url?: string | null;
  username?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  className?: string;
}

const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14", xl: "h-24 w-24" };

export default function UserAvatar({ url, username, size = "md", online, className }: Props) {
  const resolved = avatarPublicUrl(url);
  const initial = (username ?? "?").charAt(0).toUpperCase();
  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className={cn(sizes[size], "border-2 border-primary/30")}>
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
