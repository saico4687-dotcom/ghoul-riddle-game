import { supabase } from "@/integrations/supabase/client";

// دوال مساعدة لحالة "دردشة بدون إعلانات" — بتتخزن في عمود
// ad_free_until على جدول profiles، وبتتمنح فقط عن طريق RPC آمنة
// (grant_ad_free_reward) بعد مشاهدة 5 إعلانات مكافأة ورا بعض.

export async function fetchAdFreeUntil(userId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("ad_free_until")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as any)?.ad_free_until ?? null;
}

export function isAdFreeActive(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

// بتنادي RPC آمنة تمنح المستخدم الحالي (auth.uid() في السيرفر) مدة
// إضافية بدون إعلانات. لا يمكن استدعاؤها لصالح مستخدم تاني.
export async function grantAdFreeReward(hours = 12): Promise<string> {
  const { data, error } = await supabase.rpc("grant_ad_free_reward", { _hours: hours } as any);
  if (error) throw error;
  return data as string;
}
