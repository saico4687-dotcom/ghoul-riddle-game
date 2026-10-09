import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { allow, type IceServer, normalizeCloudflare, STUN_FALLBACK, staticTurn } from "./logic.ts";

// بيدّي التطبيق خوادم ICE (STUN/TURN) من غير ما أي سر يتحط في الكود أو الـ APK.
// الأولوية: Cloudflare (بيانات مؤقتة) ← بعدين بيانات ثابتة من Secrets (Metered مثلًا).
// Secrets المطلوبة (واحد من الاتنين):
//   CF_TURN_KEY_ID + CF_TURN_API_TOKEN
//   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
// لازم يكون المستخدم مسجّل دخول.

const CF_TTL_S = 3600; // ساعة تكفي أي مكالمة
const hits = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    if (!allow(hits, userId, Date.now())) return json({ error: "rate_limited" }, 429);

    const servers: IceServer[] = [STUN_FALLBACK];
    let ttl = 0;

    const cfId = Deno.env.get("CF_TURN_KEY_ID");
    const cfToken = Deno.env.get("CF_TURN_API_TOKEN");
    if (cfId && cfToken) {
      try {
        const r = await fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(cfId)}/credentials/generate-ice-servers`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ttl: CF_TTL_S }),
          },
        );
        if (r.ok) {
          const cf = normalizeCloudflare(await r.json());
          if (cf) { servers.push(...cf); ttl = CF_TTL_S; }
        } else {
          console.error("cloudflare turn status", r.status);
        }
      } catch (e) {
        console.error("cloudflare turn error", e instanceof Error ? e.message : e);
      }
    }

    if (ttl === 0) {
      const st = staticTurn(Deno.env.get("TURN_URLS"), Deno.env.get("TURN_USERNAME"), Deno.env.get("TURN_CREDENTIAL"));
      if (st) { servers.push(...st); ttl = 1800; }
    }

    // لو مفيش TURN متظبط: STUN بس (التطبيق بيكمل، والصوت ممكن يفشل على بعض الشبكات).
    return json({ iceServers: servers, ttl, turn: ttl > 0 });
  } catch (e) {
    console.error("turn-credentials error", e instanceof Error ? e.message : e);
    return json({ error: "Internal error" }, 500);
  }
});
