import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set the project root to silence warnings about multiple lockfiles.
  turbopack: {
    root: process.cwd(),
  },
  // Do not expose server-only secrets (e.g. Supabase service role key) via `env`.
  // `NEXT_PUBLIC_*` vars are automatically available to the client by Next.js.
};

export default nextConfig;
