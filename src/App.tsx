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
import ChatHome from "./pages/chat/ChatHome";
import ChatSearch from "./pages/chat/ChatSearch";
import ChatProfile from "./pages/chat/ChatProfile";
import ChatConversation from "./pages/chat/ChatConversation";
import ChatFriends from "./pages/chat/ChatFriends";
import ChatNotifications from "./pages/chat/ChatNotifications";
import ChatSettings from "./pages/chat/ChatSettings";
import ChatSafety from "./pages/chat/ChatSafety";
import ChatGuidelines from "./pages/chat/ChatGuidelines";
import ChatPrivacy from "./pages/chat/ChatPrivacy";
import UsernameSetup from "./pages/chat/UsernameSetup";

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

        if (isNativePlatform()) {
          console.log("[App] Starting AdMob initialization...");
          await requestUMPConsent();
          await initAdMob();
          console.log("[App] AdMob initialization completed");
        }

        // إخفاء Splash Screen بعد التهيئة
        splashTimer = window.setTimeout(() => {
          setShowSplash(false);
        }, 1500); // 1.5 ثانية كافية

      } catch (err) {
        console.error("[App Init Error]", err);
        setTimeout(() => setShowSplash(false), 2500);
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
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/delete-account" element={<DeleteAccount />} />
              <Route path="/auth/callback" element={<OAuthCallback />} />
              <Route path="/\~oauth/callback" element={<OAuthCallback />} />
              <Route path="/auth/*" element={<OAuthCallback />} />

              <Route path="/chat/setup" element={<UsernameSetup />} />

              <Route path="/chat" element={<RequireCompletion><ChatLayout /></RequireCompletion>}>
                <Route index element={<ChatHome />} />
                <Route path="search" element={<ChatSearch />} />
                <Route path="friends" element={<ChatFriends />} />
                <Route path="notifications" element={<ChatNotifications />} />
                <Route path="settings" element={<ChatSettings />} />
                <Route path="safety" element={<ChatSafety />} />
                <Route path="guidelines" element={<ChatGuidelines />} />
                <Route path="privacy" element={<ChatPrivacy />} />
                <Route path="u/:username" element={<ChatProfile />} />
                <Route path="c/:id" element={<ChatConversation />} />
              </Route>

              <Route path="*" element={<Index />} />
            </Routes>
          </DesktopFrame>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
