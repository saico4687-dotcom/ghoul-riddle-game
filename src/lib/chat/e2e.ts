// تشفير طرف لطرف (End-to-End Encryption) لنصوص الرسائل في المحادثات
// الفردية فقط (الجروبات لسه مش مشمولة — محتاجة تصميم تاني لتوزيع
// المفتاح على كل الأعضاء).
//
// الطريقة: كل مستخدم بيولّد زوج مفاتيح ECDH (منحنى P-256) أول مرة يفتح
// فيها الشات على الجهاز ده. المفتاح الخاص بيتخزن في localStorage على
// جهاز المستخدم بس وماينفعش يتسرّب للسيرفر أبدًا. المفتاح العام بس هو
// اللي بيترفع لعمود profiles.public_key عشان أي طرف تاني يقدر يجيبه.
//
// لما اليوزر A يبعت رسالة لليوزر B: بيشتق "مفتاح مشترك" (Shared Secret)
// من (مفتاح A الخاص + مفتاح B العام) عن طريق ECDH، وبيشفّر بيه النص
// بـ AES-GCM. اليوزر B بيقدر يشتق نفس المفتاح المشترك بالظبط من
// (مفتاح B الخاص + مفتاح A العام) — خاصية ECDH الرياضية. السيرفر شايف
// بس نص مشفّر عشوائي، ومعندوش أي مفتاح خاص يقدر يفك بيه أي رسالة.
//
// ملاحظة: المفتاح الخاص محلي على الجهاز، فلو المستخدم بدّل جهاز أو مسح
// بيانات المتصفح، هيتولّد له مفتاح جديد ومش هيقدر يفك تشفير الرسائل
// القديمة اللي اتشفرت بالمفتاح القديم (نفس سلوك تطبيقات E2E التقليدية
// بدون نسخ احتياطي للمفاتيح).

import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY_PREFIX = "chat_e2e_privkey_";
const BODY_PREFIX = "e2e1:";

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64decode(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function generateKeyPair() {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
}

/** يتأكد إن عندي زوج مفاتيح على الجهاز ده، ويرفع المفتاح العام للبروفايل لو لسه متعمّلوش رفع. */
export async function ensureLocalKeyPair(myUserId: string): Promise<CryptoKey> {
  const storageKey = LOCAL_KEY_PREFIX + myUserId;
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const jwk = JSON.parse(stored);
      const privateKey = await crypto.subtle.importKey(
        "jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
      );
      return privateKey;
    } catch {
      // مفتاح تالف محليًا — هنولّد واحد جديد بدل ما نوقف الشات بالكامل
    }
  }

  const { privateKey, publicKey } = await generateKeyPair();
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  localStorage.setItem(storageKey, JSON.stringify(jwk));

  const rawPub = await crypto.subtle.exportKey("raw", publicKey);
  const publicKeyB64 = b64encode(rawPub);
  await supabase.from("profiles").update({ public_key: publicKeyB64 } as any).eq("user_id", myUserId);

  return privateKey;
}

const sharedKeyCache = new Map<string, CryptoKey>();

/** يشتق المفتاح المشترك (AES-GCM) بين مفتاحي الخاص ومفتاح الطرف التاني العام. */
export async function deriveSharedKey(myPrivateKey: CryptoKey, otherPublicKeyB64: string, cacheKey: string): Promise<CryptoKey | null> {
  const cached = sharedKeyCache.get(cacheKey);
  if (cached) return cached;
  try {
    const otherPublicKey = await crypto.subtle.importKey(
      "raw", b64decode(otherPublicKeyB64), { name: "ECDH", namedCurve: "P-256" }, true, []
    );
    const shared = await crypto.subtle.deriveKey(
      { name: "ECDH", public: otherPublicKey },
      myPrivateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    sharedKeyCache.set(cacheKey, shared);
    return shared;
  } catch {
    return null;
  }
}

/** يشفّر نص عادي، وبيرجّع body جاهز للتخزين في الداتابيز بصيغة "e2e1:iv:ciphertext" (Base64). */
export async function encryptBody(sharedKey: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  return `${BODY_PREFIX}${b64encode(iv.buffer)}:${b64encode(ciphertext)}`;
}

/** لو الـ body مشفّر، بيفكّه. لو نص عادي (رسائل قديمة قبل تفعيل E2E) بيرجّعه زي ما هو. */
export async function decryptBody(sharedKey: CryptoKey | null, body: string | null | undefined): Promise<string> {
  if (!body) return "";
  if (!body.startsWith(BODY_PREFIX)) return body; // نص عادي (قديم أو لسه مفتاح الطرف التاني مش جاهز)
  if (!sharedKey) return "🔒 رسالة مشفّرة";
  try {
    const [, ivB64, ctB64] = body.split(":");
    const iv = new Uint8Array(b64decode(ivB64));
    const ciphertext = b64decode(ctB64);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
    return new TextDecoder().decode(plainBuf);
  } catch {
    return "🔒 تعذر فك تشفير هذه الرسالة";
  }
}

export function isEncryptedBody(body: string | null | undefined): boolean {
  return !!body && body.startsWith(BODY_PREFIX);
}
