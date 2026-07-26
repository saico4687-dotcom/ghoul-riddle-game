import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Home, Users, MessageSquare, Bell, Settings as SettingsIcon, ArrowRight } from "lucide-react";
import { usePresence } from "@/hooks/usePresence";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { cn } from "@/lib/utils";
import AdFreeTimer from "@/components/chat/AdFreeTimer";
import ChatBannerSlot, { BOTTOM_NAV_HEIGHT, BANNER_SLOT_HEIGHT } from "@/components/chat/ChatBannerSlot";

export default function ChatLayout() {
  usePresence();
  const unread = useUnreadCount();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-primary">
          <ArrowRight className="w-5 h-5" />
          <span className="font-horror text-sm">الرئيسية</span>
        </button>
        <h1 className="font-horror text-lg text-primary">الدردشة</h1>
        <div className="w-16" />
      </header>

      {/* مكان فاضي ثابت أعلى الصفحة لساعة العد التنازلي — بياخد مكانه
          في التخطيط العادي (مش overlay) فمبيغطيش على أي حاجة، ومش
          بيظهر أصلاً لو مفيش مكافأة "دردشة بدون إعلانات" نشطة */}
      <AdFreeTimer />

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: BOTTOM_NAV_HEIGHT + BANNER_SLOT_HEIGHT }}>
        <Outlet />
      </main>

      {/* مساحة فاضية محجوزة لبانر الإعلانات — فوق شريط التنقل السفلي
          مباشرة، عشان الإعلان ميغطيش على أزرار التنقل ولا آخر رسالة */}
      <div className="fixed left-0 right-0 z-30" style={{ bottom: BOTTOM_NAV_HEIGHT }}>
        <ChatBannerSlot />
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border z-40"
        style={{ height: BOTTOM_NAV_HEIGHT }}
      >
        <div className="grid grid-cols-5 h-full">
          <TabLink to="/chat" icon={<Home className="w-5 h-5" />} label="الرئيسية" end />
          <TabLink to="/chat/friends" icon={<Users className="w-5 h-5" />} label="الأصدقاء" />
          <TabLink to="/chat/search" icon={<MessageSquare className="w-5 h-5" />} label="بحث" />
          <TabLink to="/chat/notifications" icon={<Bell className="w-5 h-5" />} label="إشعارات" badge={unread} />
          <TabLink to="/chat/settings" icon={<SettingsIcon className="w-5 h-5" />} label="إعدادات" />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ to, icon, label, badge, end }: { to: string; icon: React.ReactNode; label: string; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-1 h-full text-[11px] font-typewriter",
          isActive ? "text-primary" : "text-muted-foreground"
        )
      }
    >
      <div className="relative">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[9px] rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </div>
      <span>{label}</span>
    </NavLink>
  );
}
