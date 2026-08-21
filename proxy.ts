import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Integración de Clerk con Next.js.
 *
 * Deliberadamente NO se protegen rutas aquí por coincidencia de rutas
 * (`createRouteMatcher`). Clerk lo desaconseja — y lo ha marcado como
 * obsoleto — porque el path matching puede divergir de cómo Next enruta
 * realmente la petición y dejar recursos protegidos alcanzables. Da sensación
 * de seguridad sin garantizarla.
 *
 * La autorización de esta aplicación es *por recurso* y ya es exhaustiva:
 *
 *   - Páginas: `app/(dashboard)/layout.tsx` y
 *     `app/(developer)/developer-console/layout.tsx` resuelven la sesión y
 *     redirigen antes de renderizar nada.
 *   - Rutas de API: cada una llama a `requireProfile()` / `requireAuthUser()` /
 *     `requireProductAccess()` de `lib/server/authz.ts`.
 *   - API pública de integradores: `authenticateAPIKey()` (clave, no sesión).
 *   - `support/email-sync`: secreto compartido propio.
 *
 * Lo que sí aporta este middleware, y es imprescindible:
 *   1. Deja `auth()` y `currentUser()` disponibles en componentes de servidor,
 *      rutas y server actions.
 *   2. Refresca la cookie de sesión en cada petición. Esa era la causa de los
 *      cierres de sesión aleatorios del sistema anterior, que no tenía
 *      middleware y no podía reescribir cookies desde un Server Component.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Todo excepto los estáticos de Next y los ficheros con extensión.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Siempre las rutas de API.
    '/(api|trpc)(.*)',
    // Proxy automático de Clerk.
    '/__clerk/:path*',
  ],
};
