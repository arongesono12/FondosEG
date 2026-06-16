import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  type CookieSetOptions = Exclude<Parameters<typeof cookieStore.set>[2], undefined>;

  function cleanCookieOptions(options?: CookieSetOptions) {
    if (!options) return undefined;

    return Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined)
    ) as CookieSetOptions;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cleanOptions = cleanCookieOptions(options);
              if (cleanOptions) {
                cookieStore.set(name, value, cleanOptions);
              } else {
                cookieStore.set(name, value);
              }
            });
          } catch {
            // Server Components cannot set cookies. Server Actions and Route
            // Handlers can, which is where auth mutations happen.
          }
        },
      },
    }
  );
}
