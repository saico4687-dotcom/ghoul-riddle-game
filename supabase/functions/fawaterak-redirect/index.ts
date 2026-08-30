import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * صفحة وسيطة بسيطة: Fawaterak (على عكس بايموب) بيرفض حفظ روابط
 * الرجوع لو مش HTTP/HTTPS حقيقية، يعني مينفعش نحط
 * "com.rebh.app://payment-result" مباشرة في إعدادات Fawaterak.
 *
 * الحل: نحط رابط الفنكشن ده (HTTPS حقيقي) في لوحة Fawaterak، وهو
 * بدوره أول ما يتفتح بيحوّل فورًا لسكيم التطبيق. الاعتراض في
 * src/lib/fawaterak.ts (CapacitorApp.addListener("appUrlOpen", ...))
 * بيشتغل زي ما هو من غير أي تعديل.
 *
 * استخدامه في لوحة Fawaterak → Integrations:
 *   Success Redirect Url: …/functions/v1/fawaterak-redirect?status=success
 *   Pending Redirect Url: …/functions/v1/fawaterak-redirect?status=pending
 *   Fail Redirect Url:    …/functions/v1/fawaterak-redirect?status=fail
 */

const ALLOWED_STATUSES = new Set(["success", "pending", "fail"]);

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "";
  const status = ALLOWED_STATUSES.has(statusParam) ? statusParam : "pending";
  const appUrl = `com.rebh.app://payment-result?status=${status}`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url=${appUrl}" />
<title>جاري الرجوع للتطبيق…</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding-top:3rem;">
  <p>جاري الرجوع للتطبيق…</p>
  <p><a href="${appUrl}">دوس هنا لو مرجعتش تلقائيًا</a></p>
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
});
