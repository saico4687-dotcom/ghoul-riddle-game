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
    const { data: files, error: listError } = await admin.storage.from(BUCKET).list("", {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (listError && !String(listError.message).toLowerCase().includes("not found")) {
      throw listError;
    }

    const filePaths = (files ?? [])
      .filter((file) => file.name && file.id)
      .map((file) => file.name);

    if (filePaths.length > 0) {
      const { error: removeFilesError } = await admin.storage.from(BUCKET).remove(filePaths);
      if (removeFilesError) throw removeFilesError;
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
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});