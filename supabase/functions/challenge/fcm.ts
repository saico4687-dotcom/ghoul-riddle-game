// إرسال إشعار FCM (HTTP v1). المفتاح السري في Supabase Secret: FCM_SERVICE_ACCOUNT_JSON
// لو السر مش موجود أو حصل خطأ: بنسكت (التحدي نفسه شغال من غير إشعار).
function b64url(buf: ArrayBuffer | string): string {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  const jwt = `${head}.${body}.${b64url(sig)}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!r.ok) return null;
  return ((await r.json()) as { access_token?: string }).access_token ?? null;
}

// admin: عميل service-role. بيبعت لكل أجهزة المستخدم وبيمسح التوكنات الميتة.
export async function sendChallengePush(admin: any, userId: string, title: string, body: string, challengeId: string): Promise<void> {
  try {
    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!raw) return;
    const sa = JSON.parse(raw);
    const { data: toks } = await admin.from("fcm_tokens").select("token").eq("user_id", userId);
    if (!toks || toks.length === 0) return;
    const at = await accessToken(sa);
    if (!at) return;
    for (const t of toks as { token: string }[]) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title, body },
            data: { type: "challenge", id: challengeId },
            android: { priority: "HIGH", ttl: "60s", notification: { channel_id: "challenges", sound: "default" } },
          },
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        if (txt.includes("UNREGISTERED") || txt.includes("INVALID_ARGUMENT")) {
          await admin.from("fcm_tokens").delete().eq("token", t.token);
        }
      }
    }
  } catch (_e) {
    // الإشعار best-effort
  }
}
