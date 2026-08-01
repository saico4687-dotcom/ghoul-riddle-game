// Hook قفل الدردشة: بيقرأ حالة app_lock_enabled من profiles، وبيدير
// حالة "مفتوح/مقفول" على مستوى التبويب الحالي (sessionStorage) — يعني
// لو قفلت وفتحت التطبيق تاني هيطلب الرمز، لكن مش هيطلبه كل تنقل بين
// صفحات الدردشة في نفس الجلسة. كمان بيقفل تلقائيًا لو التطبيق قعد في
// الخلفية أكتر من IDLE_LOCK_MS.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

const UNLOCKED_KEY = "chat_app_lock_unlocked_v1";
const HIDDEN_AT_KEY = "chat_app_lock_hidden_at_v1";
const IDLE_LOCK_MS = 30_000; // لو التطبيق مغلق/في الخلفية أكتر من 30 ثانية، يتقفل تاني

export function useAppLock() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(UNLOCKED_KEY) === "1"
  );

  const refresh = useCallback(async () => {
    if (!user) {
      setEnabled(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("app_lock_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    setEnabled(Boolean((data as any)?.app_lock_enabled));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // قفل تلقائي بعد رجوع التطبيق من الخلفية لمدة طويلة
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now()));
      } else {
        const hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT_KEY) ?? 0);
        if (hiddenAt && Date.now() - hiddenAt > IDLE_LOCK_MS) {
          lock();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = useCallback(async (pin: string) => {
    const { data, error } = await supabase.rpc("verify_app_lock_pin", { p_pin: pin });
    if (error) return false;
    return Boolean(data);
  }, []);

  const unlock = useCallback(() => {
    sessionStorage.setItem(UNLOCKED_KEY, "1");
    setUnlocked(true);
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(UNLOCKED_KEY);
    setUnlocked(false);
  }, []);

  const setPin = useCallback(
    async (pin: string) => {
      const { error } = await supabase.rpc("set_app_lock_pin", { p_pin: pin });
      if (error) throw error;
      await refresh();
      unlock();
    },
    [refresh, unlock]
  );

  const disable = useCallback(async () => {
    const { error } = await supabase.rpc("disable_app_lock");
    if (error) throw error;
    await refresh();
    unlock();
  }, [refresh, unlock]);

  return { enabled, loading, unlocked, verify, unlock, lock, setPin, disable };
}
