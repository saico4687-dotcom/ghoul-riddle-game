import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "payment-proofs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing backend credentials");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: files, error: listError } = await admin
      .schema("storage")
      .from("objects")
      .select("name")
      .eq("bucket_id", BUCKET)
      .limit(1000);

    if (listError && !String(listError.message).toLowerCase().includes("not found")) {
      throw listError;
    }

    const filePaths = (files ?? []).map((file) => file.name).filter(Boolean);

    const { error: emptyBucketError } = await admin.storage.emptyBucket(BUCKET);
    if (emptyBucketError && !String(emptyBucketError.message).toLowerCase().includes("not found")) {
      throw emptyBucketError;
    }

    const { error: removeBucketError } = await admin.storage.deleteBucket(BUCKET);
    if (removeBucketError && !String(removeBucketError.message).toLowerCase().includes("not found")) {
      throw removeBucketError;
    }

    return new Response(JSON.stringify({ success: true, removedFiles: filePaths.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});