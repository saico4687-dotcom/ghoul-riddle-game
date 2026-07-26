import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchAdFreeUntil, isAdFreeActive } from "@/lib/chat/adFree";

// Hook مشترك بيرجع حالة "دردشة بدون إعلانات" لصاحب الحساب الحالي —
// يُستخدم في إخفاء البانر، منع الإعلان الفاصل كل 10 رسائل، وإظهار
// الساعة التنازلية والطوق الذهبي.
export function useAdFree() {
  const { user } = useAuth();
  const [until, setUntil] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const u = await fetchAdFreeUntil(user.id);
    setUntil(u);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { adFreeUntil: until, isAdFree: isAdFreeActive(until), refresh };
}
