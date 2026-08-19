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

const imgSrc = ["'self'", "data:", "blob:", supabaseOrigin]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
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
