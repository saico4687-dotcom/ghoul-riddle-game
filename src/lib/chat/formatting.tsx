import type { ReactNode } from "react";

// صيغة رسالة "مشاركة الموقع": body بيكون بالظبط "geo:LAT,LNG" (نص عادي —
// إحداثيات فقط، فمفيش حرج في تخزينها دائم زي ما هو متفق عليه، من غير
// أي وسائط أو تخزين مؤقت).
const GEO_PREFIX = "geo:";

export function isLocationBody(body: string | null | undefined): boolean {
  if (!body) return false;
  return /^geo:-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(body.trim());
}

export function parseLocationBody(body: string): { lat: number; lng: number } | null {
  if (!isLocationBody(body)) return null;
  const [lat, lng] = body.trim().slice(GEO_PREFIX.length).split(",").map(Number);
  return { lat, lng };
}

export function makeLocationBody(lat: number, lng: number): string {
  return `${GEO_PREFIX}${lat},${lng}`;
}

// معاينة آمنة لاستخدامها في قائمة "المحادثات الأخيرة": last_message_preview
// جاي من الداتابيز كنص خام (أول 120 حرف من body) — لو الرسالة متشفّرة
// E2E أو رسالة موقع، بنعرض تسمية واضحة بدل النص المشفّر/الإحداثيات الخام.
export function previewLabel(raw: string | null | undefined): string {
  if (!raw) return "ابدأ المحادثة...";
  if (raw.startsWith("e2e1:")) return "🔒 رسالة مشفّرة";
  if (raw.startsWith("geo:")) return "📍 موقع مُشارك";
  return raw;
}

// يفكّك نص الرسالة لأجزاء منسّقة زي واتساب بالظبط:
//   *bold*      -> غامق
//   _italic_    -> مائل
//   ~strike~    -> يتوسطه خط
//   `mono`      -> عريض ثابت العرض (code)
// وكمان يلوّن المنشن (@username) بلون التمييز.
// الرمز نفسه (النجمة/الشرطة..) بيتشال من العرض زي واتساب بالظبط.

type Token = { text: string; bold?: boolean; italic?: boolean; strike?: boolean; mono?: boolean };

// كل نمط لازم يكون محاط بمسافة/بداية-نهاية أو علامة ترقيم عشان ميتفعلش
// جوه كلمات عادية زي "علاء_الدين" أو "٣*٥". نفس قاعدة واتساب تقريبًا:
// نطابق أقرب زوج رموز متلاصق بمحتوى مش فاضي وبدون مسافة على حوافه.
const PATTERN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;

function tokenize(body: string): Token[] {
  const parts = body.split(PATTERN);
  const tokens: Token[] = [];
  for (const part of parts) {
    if (!part) continue;
    const first = part[0];
    const last = part[part.length - 1];
    const inner = part.slice(1, -1);
    // لازم يبدأ وينتهي بنفس الرمز، وميبدأش/ينتهيش بمسافة (زي واتساب)
    const validEdges = inner.length > 0 && !/^\s|\s$/.test(inner);
    if (first === "*" && last === "*" && validEdges) {
      tokens.push({ text: inner, bold: true });
    } else if (first === "_" && last === "_" && validEdges) {
      tokens.push({ text: inner, italic: true });
    } else if (first === "~" && last === "~" && validEdges) {
      tokens.push({ text: inner, strike: true });
    } else if (first === "`" && last === "`" && validEdges) {
      tokens.push({ text: inner, mono: true });
    } else {
      tokens.push({ text: part });
    }
  }
  return tokens;
}

function renderMentions(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(@[A-Za-z0-9_\u0600-\u06FF]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={`${keyPrefix}-${i}`} className="text-primary font-bold">
        {p}
      </span>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{p}</span>
    )
  );
}

/** يرندر نص الرسالة كامل: تنسيق (bold/italic/strike/mono) + منشن @user */
export function renderMessageBody(body: string): ReactNode {
  return tokenize(body).map((t, i) => {
    const content = renderMentions(t.text, `t${i}`);
    if (t.mono) {
      return (
        <code key={i} className="font-mono bg-black/20 rounded px-1 py-0.5 text-[0.9em]">
          {content}
        </code>
      );
    }
    return (
      <span
        key={i}
        className={[t.bold && "font-bold", t.italic && "italic", t.strike && "line-through"]
          .filter(Boolean)
          .join(" ")}
      >
        {content}
      </span>
    );
  });
}
