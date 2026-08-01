import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// بيتنادى من العميل (المستقبل) أول ما يفتح/يشغّل وسائط مؤقتة
// فعليًا لأول مرة. بيتأكد إن الطالب فعلاً طرف في المحادثة أو عضو
// نشط في الجروب (عن طريق دالة SQL بصلاحيات المستخدم نفسه)، وبعدين
// يمسح الملف فورًا من الـ bucket بصلاحية service role.

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: { message_id?: string; kind?: "dm" | "group" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid body" }), { status: 400 });
  }

  const { message_id, kind } = body;
  if (!message_id || (kind !== "dm" && kind !== "group")) {
    return new Response(JSON.stringify({ error: "message_id and kind (dm|group) are required" }), { status: 400 });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // عميل بهوية المستخدم صاحب الطلب — يفرض RLS/الصلاحيات كما هي
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const rpcName = kind === "dm" ? "ack_dm_media_delivered" : "ack_group_media_delivered";
  const { data: path, error: rpcError } = await userClient.rpc(rpcName, { _message_id: message_id });

  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), { status: 400 });
  }
  if (!path) {
    // مفيش صلاحية، أو الملف اتمسح خلاص — مش خطأ، بس مفيش حاجة نعملها
    return new Response(JSON.stringify({ deleted: false }), { status: 200 });
  }

  const adminClient = createClient(url, serviceKey);

  const { error: removeError } = await adminClient.storage.from("ephemeral-media").remove([path]);
  if (removeError) {
    return new Response(JSON.stringify({ error: removeError.message }), { status: 500 });
  }

  const { error: markError } = await adminClient.rpc("mark_media_deleted", { _paths: [path] });
  if (markError) {
    return new Response(JSON.stringify({ error: markError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
