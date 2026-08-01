import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// دالة مجدولة (pg_cron → pg_net) بتناديها كل 15 دقيقة. محمية بمفتاح
// مشترك ثابت بدل من JWT عادي (مفيش وصول لمفتاح service_role الحقيقي
// من خلال أدوات MCP)، فمفيش verify_jwt على مستوى الـ gateway. لو عايز
// ترقية الأمان، انقل السر ده لـ Supabase Function Secrets من الداشبورد بدل
// من القيمة الثابتة دي.
const CLEANUP_SHARED_SECRET = "e9de4eba042dbd5a5f13537f118f9639774cd203e5ece6ecc4d1d3cc31c99c2";

Deno.serve(async (req: Request) => {
  const provided = req.headers.get("x-cleanup-secret");
  if (provided !== CLEANUP_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(url, serviceKey);

  const { data: rows, error: listError } = await adminClient.rpc("list_expired_ephemeral_media");
  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), { status: 500 });
  }

  const paths = Array.from(new Set((rows ?? []).map((r: { path: string }) => r.path))).filter(Boolean) as string[];

  if (paths.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 });
  }

  const chunkSize = 100;
  let deletedCount = 0;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error: removeError } = await adminClient.storage.from("ephemeral-media").remove(chunk);
    if (removeError) {
      console.error("storage remove error", removeError.message);
      continue;
    }
    const { error: markError } = await adminClient.rpc("mark_media_deleted", { _paths: chunk });
    if (markError) {
      console.error("mark_media_deleted error", markError.message);
      continue;
    }
    deletedCount += chunk.length;
  }

  return new Response(JSON.stringify({ deleted: deletedCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
