import { callFondosegApi, json } from "../_shared/fondoseg-client.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "GET") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const result = await callFondosegApi("/api/external/balance", {
      method: "GET",
    });

    return json(
      {
        success: result.ok,
        source: "fondoseg-balance",
        target_url: result.targetUrl,
        data: result.body,
      },
      result.status,
    );
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
