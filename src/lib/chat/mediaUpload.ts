import { supabase } from "@/integrations/supabase/client";
import { encryptFile, decryptToBlob, detectMediaKind, MEDIA_LIMITS, type MediaKind } from "./mediaCrypto";
import { checkRateLimit } from "./contentFilter";

const BUCKET = "ephemeral-media";
const MAX_TTL_HOURS = 72;

function randomFileName() {
  return crypto.randomUUID();
}

async function uploadEncrypted(pathPrefix: string, file: File | Blob, mime: string) {
  const { ciphertext, ivBase64, keyBase64 } = await encryptFile(file);
  const path = `${pathPrefix}/${randomFileName()}.enc`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, ciphertext, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message || "تعذر رفع الملف");
  return { path, ivBase64, keyBase64, mime };
}

function assertSizeOk(kind: MediaKind, size: number) {
  const limit = MEDIA_LIMITS[kind];
  if (size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    throw new Error(`حجم الملف أكبر من الحد المسموح (${mb}MB)`);
  }
}

// ---------- محادثات فردية ----------

export async function sendDmMediaMessage(
  conversationId: string,
  senderId: string,
  file: File | Blob,
  mime: string,
  opts?: { durationSeconds?: number; replyToId?: string | null }
) {
  const rl = checkRateLimit(conversationId);
  if (!rl.ok) throw new Error(`تجاوزت الحد المسموح. حاول بعد ${Math.ceil(rl.retryInMs / 1000)} ثانية`);

  const kind = detectMediaKind(mime);
  if (!kind) throw new Error("نوع ملف غير مدعوم");
  assertSizeOk(kind, file.size);

  const { path, ivBase64, keyBase64 } = await uploadEncrypted(`dm/${conversationId}`, file, mime);
  const expiresAt = new Date(Date.now() + MAX_TTL_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: kind === "image" ? "📷 صورة" : kind === "video" ? "🎥 فيديو" : "🎤 رسالة صوتية",
      delivered_at: new Date().toISOString(),
      reply_to_id: opts?.replyToId ?? null,
      media_path: path,
      media_type: kind,
      media_mime: mime,
      media_size_bytes: file.size,
      media_duration_seconds: opts?.durationSeconds ?? null,
      media_iv: ivBase64,
      media_key: keyBase64,
      media_expires_at: expiresAt,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendGroupMediaMessage(
  groupId: string,
  senderId: string,
  file: File | Blob,
  mime: string,
  opts?: { durationSeconds?: number; replyToId?: string | null }
) {
  const kind = detectMediaKind(mime);
  if (!kind) throw new Error("نوع ملف غير مدعوم");
  assertSizeOk(kind, file.size);

  const { path, ivBase64, keyBase64 } = await uploadEncrypted(`group/${groupId}`, file, mime);
  const expiresAt = new Date(Date.now() + MAX_TTL_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_id: senderId,
      body: kind === "image" ? "📷 صورة" : kind === "video" ? "🎥 فيديو" : "🎤 رسالة صوتية",
      reply_to_id: opts?.replyToId ?? null,
      media_path: path,
      media_type: kind,
      media_mime: mime,
      media_size_bytes: file.size,
      media_duration_seconds: opts?.durationSeconds ?? null,
      media_iv: ivBase64,
      media_key: keyBase64,
      media_expires_at: expiresAt,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- تحميل وفك تشفير للعرض ----------

export async function downloadAndDecrypt(mediaPath: string, ivBase64: string, keyBase64: string, mime: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(mediaPath);
  if (error || !data) throw new Error("انتهت صلاحية هذه الوسائط أو تم حذفها");
  return decryptToBlob(data, ivBase64, keyBase64, mime);
}

// ---------- تأكيد الاستلام (يمسح الملف فورًا من الـ bucket) ----------

export async function ackMediaViewed(messageId: string, kind: "dm" | "group") {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ack-media-view`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message_id: messageId, kind }),
    });
  } catch {
    // فشل التأكيد مش خطأ حرج — الـ cron هيمسح الملف تلقائيًا بعد أقصى مهلة على أي حال
  }
}
