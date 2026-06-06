import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { GOOGLE_WEB_CLIENT_ID, isGoogleConfigured } from "./googleAuthConfig";
import { isNativePlatform } from "./isNative";

let initialized = false;

/**
 * يهيّئ مزود تسجيل الدخول الأصلي بجوجل داخل تطبيق Capacitor.
 * يتم استدعاؤها مرة واحدة عند بدء التطبيق.
 */
export const registerNativeGoogleAuth = async () => {
  if (initialized || !isNativePlatform()) return;

  if (!isGoogleConfigured()) {
    console.warn(
      "[NativeGoogleAuth] GOOGLE_WEB_CLIENT_ID غير مُعدّ. حدّث src/lib/googleAuthConfig.ts"
    );
    return;
  }

  try {
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        mode: "online",
      },
    });
    initialized = true;
  } catch (err) {
    console.error("[NativeGoogleAuth] initialize failed:", err);
  }
};

/**
 * يبدأ تسجيل الدخول الأصلي بجوجل، يستلم idToken،
 * ثم ينشئ جلسة Supabase باستخدام signInWithIdToken.
 */
export const startNativeGoogleSignIn = async (): Promise<boolean> => {
  if (!isGoogleConfigured()) {
    toast({
      title: "إعدادات Google غير مكتملة",
      description: "لم يتم ضبط Google Client ID داخل التطبيق",
      variant: "destructive",
    });
    return false;
  }

  try {
    if (!initialized) await registerNativeGoogleAuth();

    const res = await SocialLogin.login({
      provider: "google",
      options: { scopes: ["email", "profile"] },
    });

    // النوع المُعاد متغيّر حسب المزود — نتعامل مع google بأمان
    const result: any = (res as any)?.result ?? res;
    const idToken: string | undefined = result?.idToken;

    if (!idToken) {
      toast({
        title: "تعذر تسجيل الدخول",
        description: "لم نستلم بيانات الاعتماد من Google",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      console.error("[NativeGoogleAuth] signInWithIdToken error:", error);
      toast({
        title: "فشل إنشاء الجلسة",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({ title: "تم تسجيل الدخول", description: "أهلاً بك" });
    return true;
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    // المستخدم ألغى المربع الحواري
    if (/cancel|canceled|cancelled|12501/i.test(msg)) {
      return false;
    }
    console.error("[NativeGoogleAuth] login error:", err);
    toast({
      title: "تعذر تسجيل الدخول بجوجل",
      description: msg,
      variant: "destructive",
    });
    return false;
  }
};
