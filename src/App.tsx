import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import DeleteAccount from "./pages/DeleteAccount";
import OAuthCallback from "./pages/OAuthCallback";

import SplashScreen from "./components/SplashScreen";
import AdsConsentDialog from "./components/AdsConsentDialog";
import DesktopFrame from "./components/DesktopFrame";
import RequireCompletion from "./components/RequireCompletion";

import ChatLayout from "./pages/chat/ChatLayout";
// ... باقي الـ imports

import {
  initAdMob,
  requestUMPConsent,
} from "./lib/ads";

import { isNativePlatform } from "./lib/isNative";
import { registerNativeGoogleAuth } from "./lib/nativeGoogleAuth";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let splashTimer: number;

    const init = async () => {
      try {
        if (isNativePlatform()) {
          void registerNativeGoogleAuth();
        }

        // تهيئة AdMob
        if (isNativePlatform()) {
          console.log("[App] Starting AdMob initialization...");
          await requestUMPConsent();
          await initAdMob();
          console.log("[App] AdMob initialization completed");
        }

        // إخفاء Splash بعد التهيئة (وليس بعد وقت ثابت)
        splashTimer = window.setTimeout(() => {
          setShowSplash(false);
        }, 1800); // خفضناه شوية

      } catch (err) {
        console.error("[App Init Error]", err);
        // لو حصل خطأ، نخفي السپلاش بعد 3 ثواني كحد أقصى
        setTimeout(() => setShowSplash(false), 3000);
      }
    };

    init();

    return () => {
      if (splashTimer) clearTimeout(splashTimer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <AnimatePresence mode="wait">
          {showSplash && <SplashScreen />}
        </AnimatePresence>

        <BrowserRouter>
          <AdsConsentDialog />
          <DesktopFrame>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* باقي الروتات ... */}
              <Route path="*" element={<Index />} />
            </Routes>
          </DesktopFrame>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
