import { LogOut } from "lucide-react";

interface UserProfileBarProps {
  name: string | null;
  email: string | null;
  profileImage: string | null;
  onSignOut: () => void;
}

const UserProfileBar = ({ name, email, profileImage, onSignOut }: UserProfileBarProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 card-horror px-3 py-2 flex items-center gap-3">
      {profileImage && (
        <img
          src={profileImage}
          alt={name || "User"}
          className="w-8 h-8 rounded-full border border-primary/50"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="text-right">
        <p className="font-typewriter text-xs text-foreground truncate max-w-[120px]">
          {name || email || "مستخدم"}
        </p>
      </div>
      <button
        onClick={onSignOut}
        className="p-1 text-muted-foreground hover:text-primary transition-colors"
        title="تسجيل الخروج"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};

export default UserProfileBar;
