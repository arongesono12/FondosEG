import { createClient } from "npm:@supabase/supabase-js@2";

type ProxyRequestBody = {
  path?: string;
  method?: string;
  payload?: unknown;
  headers?: Record<string, string>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function normalizeUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

Deno.serve(async (request) => {
  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const fondosegApiBaseUrl = getEnv("FONDOSEG_API_BASE_URL");
    const fondosegApiKey = getEnv("FONDOSEG_API_KEY");
    const fondosegApiSecret = getEnv("FONDOSEG_API_SECRET");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (request.method === "GET") {
      const { data: healthcheck } = await supabaseAdmin
        .from("api_keys")
        .select("id")
        .limit(1);

      return json({
        success: true,
        message: "FondosEG proxy function is running",
        env: {
          supabase_url: supabaseUrl,
          fondoseg_api_base_url: fondosegApiBaseUrl,
          has_service_role_key: Boolean(serviceRoleKey),
          has_fondoseg_api_key: Boolean(fondosegApiKey),
          has_fondoseg_api_secret: Boolean(fondosegApiSecret),
        },
        checks: {
          supabase_connection_ok: Array.isArray(healthcheck),
        },
        usage: {
          method: "POST",
          body_example: {
            path: "/api/external/balance",
            method: "GET",
            payload: null,
            headers: {},
          },
        },
      });
    }

    if (request.method !== "POST") {
      return json(
        {
          success: false,
          error: "Method not allowed",
        },
        405,
      );
    }

    const body = (await request.json()) as ProxyRequestBody;
    const path = body.path || "/api/external/balance";
    const method = (body.method || "GET").toUpperCase();
    const payload = body.payload;

    const targetUrl = normalizeUrl(fondosegApiBaseUrl, path);

    const proxiedResponse = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": fondosegApiKey,
        "x-api-secret": fondosegApiSecret,
        ...(body.headers || {}),
      },
      body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
    });

    const rawText = await proxiedResponse.text();
    let parsedBody: unknown = rawText;

    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = rawText;
    }

    return json({
      success: proxiedResponse.ok,
      target_url: targetUrl,
      status: proxiedResponse.status,
      data: parsedBody,
    }, proxiedResponse.status);
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      500,
    );
  }
});
