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
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import DeleteAccount from "./pages/DeleteAccount";
import OAuthCallback from "./pages/OAuthCallback";
import SplashScreen from "./components/SplashScreen";
import AdsConsentDialog from "./components/AdsConsentDialog";
import { initAdMob, showAppOpenAdIfDue } from "./lib/ads";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    // تأخير تشغيل الإعلانات لتجنب Crash عند بدء التطبيق
    const adsTimer = setTimeout(async () => {
      try {
        console.log("Initializing AdMob...");

        await initAdMob();
        await showAppOpenAdIfDue();

        console.log("AdMob initialized successfully");
      } catch (error) {
        console.error("AdMob startup error:", error);
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
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/~oauth/callback" element={<OAuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
