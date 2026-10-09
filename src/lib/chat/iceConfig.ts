import { supabase } from "@/integrations/supabase/client";
import { getRtcConfig } from "@/lib/chat/webrtc";

// بيجيب خوادم ICE (STUN/TURN) من السيرفر (دالة turn-credentials) بدل ما تتخزّن في التطبيق.
// لو الطلب فشل لأي سبب: بنرجع للإعدادات المحلية (STUN + أي TURN في .env) والمكالمة تكمل.

let cache: { cfg: RTCConfiguration; at: number } | null = null;
const MAX_AGE_MS = 25 * 60 * 1000;

export async function loadRtcConfig(): Promise<RTCConfiguration> {
  if (cache && Date.now() - cache.at < MAX_AGE_MS) return cache.cfg;
  try {
    const { data, error } = await supabase.functions.invoke("turn-credentials", { body: {} });
    const list = (data as { iceServers?: RTCIceServer[]; turn?: boolean } | null)?.iceServers;
    if (!error && Array.isArray(list) && list.length > 0) {
      const cfg: RTCConfiguration = { iceServers: list, iceCandidatePoolSize: 4 };
      // نخزّن بس لو فيه TURN فعلًا، عشان لو اتظبط بعدين يتجاب في المحاولة الجاية.
      if ((data as { turn?: boolean }).turn) cache = { cfg, at: Date.now() };
      return cfg;
    }
  } catch {
    /* نكمل بالاحتياطي */
  }
  return getRtcConfig();
}
