// تشفير/فك تشفير الوسائط على الجهاز (Web Crypto API، AES-GCM 256-bit)
// قبل الرفع لـ Storage bucket المؤقت. السيرفر ما بيشوفش المحتوى الأصلي
// أبداً — بس النسخة المشفّرة. المفتاح والـ IV بيتخزنوا في صف الرسالة
// نفسه (محمي بنفس RLS بتاع الرسائل، يعني بس المرسل والمستقبل/أعضاء
// الجروب يقدروا يوصلوله).
//
// ملحوظة: ده تشفير Symmetric بمفتاح عشوائي لكل رسالة — مش E2E حقيقي
// بمفاتيح غير متماثلة (هيتعمل في مرحلة منفصلة).

export type EncryptedPayload = {
  ciphertext: Blob;
  ivBase64: string;
  keyBase64: string;
};

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptFile(file: File | Blob): Promise<EncryptedPayload> {
  const key = await generateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawData = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, rawData);
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return {
    ciphertext: new Blob([encrypted], { type: "application/octet-stream" }),
    ivBase64: bufToBase64(iv.buffer),
    keyBase64: bufToBase64(rawKey),
  };
}

export async function decryptToBlob(
  encryptedBlob: Blob,
  ivBase64: string,
  keyBase64: string,
  mimeType: string
): Promise<Blob> {
  const rawKey = base64ToBuf(keyBase64);
  const iv = new Uint8Array(base64ToBuf(ivBase64));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const encryptedBuf = await encryptedBlob.arrayBuffer();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBuf);
  return new Blob([decrypted], { type: mimeType });
}

// الحدود الشائعة في واتساب تقريباً — نفس القيم اللي التزمنا بيها في
// الـ migration وفي مواصفة المشروع
export const MEDIA_LIMITS = {
  image: 16 * 1024 * 1024,
  video: 64 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
} as const;

export type MediaKind = "image" | "audio" | "video";

export function detectMediaKind(mime: string): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}
