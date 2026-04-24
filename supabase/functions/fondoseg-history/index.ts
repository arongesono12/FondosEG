import { callFondosegApi, json } from "../_shared/fondoseg-client.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "GET") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    const limit = url.searchParams.get("limit") || "50";
    const offset = url.searchParams.get("offset") || "0";

    const result = await callFondosegApi(
      `/api/external/history?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
      {
        method: "GET",
      },
    );

    return json(
      {
        success: result.ok,
        source: "fondoseg-history",
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
