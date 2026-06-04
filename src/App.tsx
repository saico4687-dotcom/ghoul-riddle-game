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

import { initAdMob, showAppOpenAdIfDue } from "./lib/ads";
import { isNativePlatform } from "./lib/isNative";
import { registerNativeGoogleAuth } from "./lib/nativeGoogleAuth";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (isNativePlatform()) {
      void registerNativeGoogleAuth();
    }

    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    const adsTimer = setTimeout(async () => {
      try {
        await initAdMob();
        await showAppOpenAdIfDue();
      } catch (error) {
        console.error(error);
      }
    }, 8000);

    return () => {
      clearTimeout(splashTimer);
      clearTimeout(adsTimer);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <AnimatePresence>
          {showSplash && <SplashScreen />}
        </AnimatePresence>

        <AdsConsentDialog />

        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/delete-account" element={<DeleteAccount />} />

            {/* OAuth callbacks */}
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/~oauth/callback" element={<OAuthCallback />} />
            <Route path="/auth/*" element={<OAuthCallback />} />

            {/* بدل 404 — رجّع للصفحة الرئيسية */}
            <Route path="*" element={<Index />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
