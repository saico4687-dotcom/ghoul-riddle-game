// PWA service worker registration with iframe/preview guards
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host === "localhost";

export async function registerPWA() {
  if (isPreviewHost || isInIframe) {
    // Cleanup any previously-registered SW in preview/iframe contexts
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
    }
    return;
  }

  if (!("serviceWorker" in navigator)) return;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch (e) {
    console.warn("PWA registration failed", e);
  }
}
