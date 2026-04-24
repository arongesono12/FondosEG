import { createClient } from "npm:@supabase/supabase-js@2";
import { callFondosegApi, getEnv, json } from "../_shared/fondoseg-client.ts";

Deno.serve(async () => {
  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const fondosegApiBaseUrl = getEnv("FONDOSEG_API_BASE_URL");
    const fondosegApiKey = getEnv("FONDOSEG_API_KEY");
    const fondosegApiSecret = getEnv("FONDOSEG_API_SECRET");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id")
      .limit(1);

    const externalBalanceCheck = await callFondosegApi("/api/external/balance", {
      method: "GET",
    });

    return json({
      success: true,
      service: "fondoseg-health",
      timestamp: new Date().toISOString(),
      env: {
        has_supabase_url: Boolean(supabaseUrl),
        has_service_role_key: Boolean(serviceRoleKey),
        has_fondoseg_api_base_url: Boolean(fondosegApiBaseUrl),
        has_fondoseg_api_key: Boolean(fondosegApiKey),
        has_fondoseg_api_secret: Boolean(fondosegApiSecret),
      },
      checks: {
        supabase_connection_ok: !error && Array.isArray(data),
        supabase_error: error?.message ?? null,
        fondoseg_api_ok: externalBalanceCheck.ok,
        fondoseg_api_status: externalBalanceCheck.status,
        fondoseg_api_target: externalBalanceCheck.targetUrl,
      },
      external_preview: externalBalanceCheck.body,
    });
  } catch (error) {
    return json(
      {
        success: false,
        service: "fondoseg-health",
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      500,
    );
  }
});
