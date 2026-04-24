export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function normalizeUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

export async function callFondosegApi(
  path: string,
  options?: {
    method?: string;
    payload?: unknown;
    headers?: Record<string, string>;
  },
) {
  const fondosegApiBaseUrl = getEnv("FONDOSEG_API_BASE_URL");
  const fondosegApiKey = getEnv("FONDOSEG_API_KEY");
  const fondosegApiSecret = getEnv("FONDOSEG_API_SECRET");

  const method = (options?.method || "GET").toUpperCase();
  const targetUrl = normalizeUrl(fondosegApiBaseUrl, path);

  const response = await fetch(targetUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": fondosegApiKey,
      "x-api-secret": fondosegApiSecret,
      ...(options?.headers || {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(options?.payload ?? {}),
  });

  const rawText = await response.text();
  let parsedBody: unknown = rawText;

  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    parsedBody = rawText;
  }

  return {
    ok: response.ok,
    status: response.status,
    targetUrl,
    body: parsedBody,
  };
}
