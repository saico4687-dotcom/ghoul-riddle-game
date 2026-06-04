import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CALLBACK_PREFIX = "com.rebh.app://oauth/callback";
const OAUTH_STATE_KEY = "rebh_native_google_oauth_state";
const OAUTH_START_URL = "https://ghoul-riddle-game.lovable.app/~oauth/initiate";

let listenerRegistered = false;

const closeBrowserSafely = async () => {
  try {
    await Browser.close();
  } catch {
    // ignore
  }
};

const extractTokensFromUrl = (url: string) => {
  const normalized = url.replace("#", "?");
  const parsed = new URL(normalized);

  const accessToken = parsed.searchParams.get("access_token");
  const refreshToken = parsed.searchParams.get("refresh_token");
  const state = parsed.searchParams.get("state");
  const error = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");

  return { accessToken, refreshToken, state, error };
};

const generateState = () => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const handleNativeAuthCallback = async ({ url }: URLOpenListenerEvent) => {
  if (!url?.startsWith(CALLBACK_PREFIX)) return;

  const { accessToken, refreshToken, state, error } = extractTokensFromUrl(url);
  await closeBrowserSafely();

  const expectedState = localStorage.getItem(OAUTH_STATE_KEY);
  localStorage.removeItem(OAUTH_STATE_KEY);

  if (expectedState && state !== expectedState) {
    toast({
      title: "فشل تسجيل Google",
      description: "انتهت صلاحية طلب تسجيل الدخول، حاول مرة أخرى",
      variant: "destructive",
    });
    return;
  }

  if (error) {
    toast({ title: "فشل تسجيل Google", description: error, variant: "destructive" });
    return;
  }

  if (!accessToken || !refreshToken) {
    toast({
      title: "فشل تسجيل Google",
      description: "لم تصل بيانات الجلسة إلى التطبيق",
      variant: "destructive",
    });
    return;
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) {
    toast({
      title: "فشل إكمال تسجيل الدخول",
      description: sessionError.message,
      variant: "destructive",
    });
    return;
  }

  toast({ title: "تم تسجيل الدخول", description: "أهلاً بك" });
};

export const registerNativeGoogleAuth = async () => {
  if (listenerRegistered) return;

  CapacitorApp.addListener("appUrlOpen", handleNativeAuthCallback);
  listenerRegistered = true;
};

export const startNativeGoogleSignIn = async () => {
  const state = generateState();
  localStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: CALLBACK_PREFIX,
    state,
    prompt: "select_account",
  });

  await Browser.open({
    url: `${OAUTH_START_URL}?${params.toString()}`,
    presentationStyle: "fullscreen",
  });
};