import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary";
import InstallPrompt from "./components/InstallPrompt";
import { registerPWA } from "./pwa";
import "./index.css";

// 🔧 مؤقت للتشخيص فقط - احذف هذا البلوك بعد حل مشكلة الإعلانات
if (typeof window !== "undefined") {
  const erudaScript = document.createElement("script");
  erudaScript.src = "https://cdn.jsdelivr.net/npm/eruda";
  erudaScript.onload = () => {
    // @ts-ignore
    window.eruda && window.eruda.init();
  };
  document.body.appendChild(erudaScript);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
    <InstallPrompt />
  </ErrorBoundary>
);

registerPWA();
