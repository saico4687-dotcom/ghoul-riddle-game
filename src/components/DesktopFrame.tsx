import { ReactNode } from "react";

/**
 * يلفّ كل صفحات التطبيق بإطار يحاكي واجهة الكمبيوتر
 * (نافذة متصفّح/سطح مكتب) مع شريط علوي وأزرار وعنوان.
 */
const DesktopFrame = ({ children }: { children: ReactNode }) => {
  return (
    <div
      className="min-h-screen w-full bg-gradient-to-br from-black via-zinc-950 to-zinc-900 p-2 sm:p-6 lg:p-10"
      dir="rtl"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        {/* نافذة على شكل واجهة كمبيوتر */}
        <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-primary/30 shadow-2xl shadow-black/60 bg-background">
          {/* شريط النافذة العلوي */}
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-900/90 border-b border-primary/20">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/90" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/90" />
              <span className="w-3 h-3 rounded-full bg-green-500/90" />
            </div>
            <div className="flex-1 mx-2 sm:mx-4">
              <div className="mx-auto max-w-md text-center text-[10px] sm:text-xs font-typewriter text-foreground/70 bg-black/50 border border-primary/20 rounded-md px-3 py-1 truncate">
                rabh-alghoul://الألغاز
              </div>
            </div>
            <span className="hidden sm:inline text-[10px] font-typewriter text-foreground/50">
              ربح الغول
            </span>
          </div>

          {/* محتوى النافذة */}
          <div className="min-h-[80vh] bg-background">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default DesktopFrame;
