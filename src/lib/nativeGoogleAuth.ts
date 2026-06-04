import { App as CapacitorApp, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CALLBACK_PREFIX = "com.rebh.app://oauth/callback";

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
  const error = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");

  return { accessToken, refreshToken, error };
};

const handleNativeAuthCallback = async ({ url }: URLOpenListenerEvent) => {
  if (!url?.startsWith(CALLBACK_PREFIX)) return;

  const { accessToken, refreshToken, error } = extractTokensFromUrl(url);
  await closeBrowserSafely();

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