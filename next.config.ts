import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not expose server-only secrets (e.g. Supabase service role key) via `env`.
  // `NEXT_PUBLIC_*` vars are automatically available to the client by Next.js.
};

export default nextConfig;
