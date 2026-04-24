import { callFondosegApi, json } from "../_shared/fondoseg-client.ts";

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const body = await request.json();

    const result = await callFondosegApi("/api/external/wallet-transfer", {
      method: "POST",
      payload: body,
    });

    return json(
      {
        success: result.ok,
        source: "fondoseg-wallet-transfer",
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
