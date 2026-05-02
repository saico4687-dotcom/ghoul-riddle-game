import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECIPIENT_NUMBERS = ["01062612970", "1062612970"];
const TRANSFER_KEYWORDS = [
  "تحويل",
  "تم تحويل",
  "تم التحويل",
  "حول",
  "حوالة",
  "Payment",
  "payment",
  "PAYMENT",
  "Transaction",
  "transaction",
  "TRANSACTION",
  "Transfer",
  "transfer",
  "TRANSFER",
  "Sent",
  "sent",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ valid: false, reason: "no_image", message: "لا توجد صورة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

    // 1) OCR via Lovable AI vision
    const ocrResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an OCR engine. Extract ALL visible text from the image exactly as written, preserving Arabic, English, numbers, dates, and times. Return only the raw extracted text without any explanation.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "استخرج كل النصوص من هذه الصورة." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!ocrResp.ok) {
      const t = await ocrResp.text();
      console.error("OCR error:", ocrResp.status, t);
      if (ocrResp.status === 429 || ocrResp.status === 402) {
        return new Response(
          JSON.stringify({ valid: false, reason: "ai_unavailable", message: "تعذر تحليل الصورة حالياً" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ valid: false, reason: "ocr_failed", message: "فشل في قراءة الصورة" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ocrData = await ocrResp.json();
    const extractedText: string = ocrData?.choices?.[0]?.message?.content || "";

    if (!extractedText || extractedText.trim().length < 5) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "no_text",
          message: "تعذر قراءة النص من الصورة",
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Check transfer keyword
    const hasTransferKeyword = TRANSFER_KEYWORDS.some((kw) => extractedText.includes(kw));
    if (!hasTransferKeyword) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "no_transfer_keyword",
          message: "لم يتم العثور على ما يشير إلى عملية تحويل",
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Check recipient number
    const normalizedDigits = extractedText.replace(/[\s\-]/g, "");
    const hasRecipient = RECIPIENT_NUMBERS.some((num) => normalizedDigits.includes(num));
    if (!hasRecipient) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "no_recipient",
          message: "لم يتم العثور على رقم المستلم",
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Extract date & time via AI
    const dtResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Extract the transaction date and time from the provided OCR text. Return ONLY valid JSON: {\"datetime\": \"YYYY-MM-DDTHH:mm:ss\"} using 24-hour format. If you cannot find a clear date and time, return {\"datetime\": null}. Do not include any other text.",
          },
          {
            role: "user",
            content: `OCR text:\n${extractedText}\n\nCurrent server time (UTC): ${new Date().toISOString()}`,
          },
        ],
      }),
    });

    let txDate: Date | null = null;
    if (dtResp.ok) {
      const dtData = await dtResp.json();
      const raw: string = dtData?.choices?.[0]?.message?.content || "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed?.datetime) {
          const d = new Date(parsed.datetime);
          if (!isNaN(d.getTime())) txDate = d;
        }
      } catch (e) {
        console.error("date parse error", e, cleaned);
      }
    }

    if (!txDate) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "no_datetime",
          message: "تعذر استخراج تاريخ ووقت العملية من الصورة",
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) Check freshness (within 24h)
    const now = Date.now();
    const diffMs = now - txDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours > 24 || diffHours < -1) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "stale",
          message: "العملية أقدم من 24 ساعة",
          extractedText,
          extractedDateTime: txDate.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        extractedText,
        extractedDateTime: txDate.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("verify-payment-proof error:", e);
    return new Response(
      JSON.stringify({
        valid: false,
        reason: "server_error",
        message: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
