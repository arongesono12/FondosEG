import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

// Los avatares se sirven desde Supabase Storage, no desde el propio origen.
// Se deriva del entorno para que cada despliegue apunte a su propio proyecto
// en lugar de llevar el host incrustado en el código.
const supabaseOrigin = (() => {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
})();

if (!supabaseOrigin) {
  // Sin esta variable en tiempo de compilación la CSP se queda restrictiva y
  // los avatares vuelven a bloquearse en silencio. Mejor que se vea en el log.
  console.warn(
    "[csp] NEXT_PUBLIC_SUPABASE_URL no está definida al compilar: " +
      "img-src no incluirá Supabase Storage y los avatares se bloquearán."
  );
}

// Clerk sirve su SDK desde el "Frontend API" de la instancia: en desarrollo
// `<slug>.clerk.accounts.dev`, en producción `clerk.<tu-dominio>`. Si la CSP no
// lo incluye, el navegador bloquea `clerk.browser.js` y no hay login posible.
//
// El host NO se pide en una variable aparte: la propia publishable key ya lo
// lleva codificado en base64 (`pk_live_<base64("clerk.midominio.com$")>`), así
// que se deriva de ella. Dos variables que deben coincidir acaban
// desincronizándose al cambiar de claves; una sola no puede.
function decodeClerkFrontendHost(publishableKey?: string): string | null {
  if (!publishableKey) return null;
  const encoded = publishableKey.replace(/^pk_(test|live)_/, "");
  if (encoded === publishableKey) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    // El valor decodificado termina en `$`, que no forma parte del host.
    const host = decoded.replace(/\$+$/, "").trim();
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

const clerkFrontendOrigin = (() => {
  // Override manual, sólo necesario si sirves Clerk tras un proxy propio.
  const rawUrl = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL;
  if (rawUrl) {
    try {
      return new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).origin;
    } catch {
      /* cae al valor derivado de la clave */
    }
  }
  return decodeClerkFrontendHost(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
})();

if (!clerkFrontendOrigin) {
  console.warn(
    "[csp] No se pudo determinar el Frontend API de Clerk: " +
      "script-src lo bloqueará y el login no cargará. " +
      "Revisa NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY."
  );
}

// `*.clerk.accounts.dev` es el Frontend API; `*.accounts.dev` (sin el prefijo
// `clerk.`) es el Account Portal alojado, al que Clerk redirige en algunos
// flujos de instancias de desarrollo. Sólo se permite fuera de producción:
// es un dominio exclusivo de instancias dev y ampliarlo en producción sería
// abrir la política sin motivo.
const clerkHosts = [
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
  isDevelopment ? "https://*.accounts.dev" : null,
  clerkFrontendOrigin,
]
  .filter(Boolean)
  .join(" ");

// Turnstile es el bot-protection de Clerk: necesita cargar script e iframe.
const turnstileHost = "https://challenges.cloudflare.com";

const imgSrc = ["'self'", "data:", "blob:", "https://img.clerk.com", supabaseOrigin]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline' ${clerkHosts} ${turnstileHost}${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    `frame-src 'self' ${clerkHosts} ${turnstileHost}`,
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ") },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Explicitly set the project root to silence warnings about multiple lockfiles.
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Do not expose server-only secrets (e.g. Supabase service role key) via `env`.
  // `NEXT_PUBLIC_*` vars are automatically available to the client by Next.js.
};

export default nextConfig;
