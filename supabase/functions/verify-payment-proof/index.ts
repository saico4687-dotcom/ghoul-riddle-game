import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECIPIENT_NUMBERS = [
  "01062612970",
  "01012377354",
  "01055010492",
  "01032319753",
];

const TRANSFER_KEYWORDS = [
  "تحويل", "تم تحويل", "تم التحويل", "حول", "حوالة",
  "Payment", "payment", "PAYMENT",
  "Transaction", "transaction", "TRANSACTION",
  "Transfer", "transfer", "TRANSFER",
  "Sent", "sent",
];

// Convert Arabic-Indic digits to ASCII
function normalizeDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // 1) OCR
    const ocrResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an OCR engine. Extract ALL visible text from the image exactly as written, preserving Arabic, English, numbers, dates, and times. Return only the raw extracted text.",
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
      return new Response(
        JSON.stringify({ valid: false, reason: "ocr_failed", message: "فشل في قراءة الصورة" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ocrData = await ocrResp.json();
    const extractedText: string = ocrData?.choices?.[0]?.message?.content || "";
    const normalizedText = normalizeDigits(extractedText);

    if (!extractedText || extractedText.trim().length < 5) {
      return new Response(
        JSON.stringify({ valid: false, reason: "no_text", message: "تعذر قراءة النص من الصورة", extractedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Transfer keyword
    if (!TRANSFER_KEYWORDS.some((kw) => extractedText.includes(kw))) {
      return new Response(
        JSON.stringify({ valid: false, reason: "no_transfer_keyword", message: "لم يتم العثور على ما يشير إلى عملية تحويل", extractedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Recipient is one of the allowed numbers
    const compactDigits = normalizedText.replace(/[\s\-]/g, "");
    const matchedRecipient = RECIPIENT_NUMBERS.find((num) => compactDigits.includes(num));
    if (!matchedRecipient) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "wrong_recipient",
          message: "رقم المستلم غير معتمد للدفع. يجب التحويل إلى أحد الأرقام المحددة.",
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Extract transaction number + datetime + AI-fraud detection in one structured call
    const analysisResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a payment-receipt forensics expert. You inspect a screenshot of a money-transfer SMS/notification AND its OCR text. Detect signs of AI generation, photoshop, font inconsistencies, or fabrication. Extract the transaction number (رقم العملية / Transaction ID) and the transaction date/time.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `OCR text:\n${extractedText}\n\nReturn ONLY a JSON object via the function call.`,
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report",
              description: "Report extracted fields and authenticity assessment.",
              parameters: {
                type: "object",
                properties: {
                  transaction_number: {
                    type: "string",
                    description: "The transaction/operation number (رقم العملية). Digits only. Empty string if not found.",
                  },
                  datetime: {
                    type: "string",
                    description: "Transaction date and time as YYYY-MM-DDTHH:mm:ss (24h). Empty if not found.",
                  },
                  is_ai_generated: {
                    type: "boolean",
                    description: "True if the image looks AI-generated, edited, or fabricated.",
                  },
                  authenticity_confidence: {
                    type: "number",
                    description: "0-1 confidence that the screenshot is a genuine real device screenshot.",
                  },
                  reasons: { type: "string", description: "Brief reasons for the authenticity verdict." },
                },
                required: ["transaction_number", "datetime", "is_ai_generated", "authenticity_confidence", "reasons"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report" } },
      }),
    });

    let txNumber = "";
    let txDate: Date | null = null;
    let isAiGenerated = false;
    let authConfidence = 1;
    let reasons = "";

    if (analysisResp.ok) {
      const aData = await analysisResp.json();
      const args = aData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      try {
        const parsed = typeof args === "string" ? JSON.parse(args) : args;
        if (parsed) {
          txNumber = normalizeDigits(String(parsed.transaction_number || "")).replace(/\D/g, "");
          if (parsed.datetime) {
            const d = new Date(parsed.datetime);
            if (!isNaN(d.getTime())) txDate = d;
          }
          isAiGenerated = !!parsed.is_ai_generated;
          authConfidence = Number(parsed.authenticity_confidence ?? 1);
          reasons = String(parsed.reasons || "");
        }
      } catch (e) {
        console.error("analysis parse error", e, args);
      }
    } else {
      console.error("analysis http error", analysisResp.status, await analysisResp.text());
    }

    // 5) AI-fraud check
    if (isAiGenerated || authConfidence < 0.5) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "ai_generated",
          message: "تم رفض الصورة، يبدو أنها مُعدّلة أو مُولّدة بالذكاء الاصطناعي.",
          extractedText,
          reasons,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!txNumber) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: "no_transaction_number",
          message: "تعذر استخراج رقم العملية من الصورة",
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    return new Response(
      JSON.stringify({
        valid: true,
        extractedText,
        extractedDateTime: txDate.toISOString(),
        transactionNumber: txNumber,
        recipientNumber: matchedRecipient,
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
