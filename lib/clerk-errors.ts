import { isClerkAPIResponseError } from '@clerk/nextjs/errors';

/**
 * Clasificación de los fallos de la API de Clerk.
 *
 * La distinción que importa: `currentUser()` devuelve `null` cuando no hay
 * sesión — NO lanza. Por tanto, cualquier error que sí llegue a lanzarse desde
 * la resolución de identidad es un problema de infraestructura o de
 * configuración, nunca un "este usuario no ha iniciado sesión".
 *
 * Confundir ambas cosas tiene una consecuencia concreta y mala: el layout del
 * dashboard redirige a `/login` cuando no hay usuario, así que un fallo de
 * Clerk expulsaba a una sesión válida al inicio de sesión. Y si el fallo es
 * permanente (una clave secreta caducada, por ejemplo), el usuario entra en
 * bucle: inicia sesión, vuelve al dashboard, falla, y de vuelta a `/login`.
 */

/**
 * Estados en los que reintentar tiene sentido: la petición puede salir bien
 * unos milisegundos después. 429 es el más frecuente con claves `sk_test`,
 * porque las instancias de desarrollo de Clerk tienen un límite de peticiones
 * mucho más bajo que las de producción.
 */
const TRANSIENT_CLERK_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Fallo de Clerk que puede resolverse solo: merece reintento. */
export function isClerkTransientError(error: unknown): boolean {
  if (!isClerkAPIResponseError(error)) return false;
  // Un error de Clerk sin estado numérico es de origen desconocido; se trata
  // como transitorio porque la alternativa —darlo por permanente— degrada la
  // sesión del usuario sin necesidad.
  if (typeof error.status !== 'number') return true;
  return TRANSIENT_CLERK_STATUSES.has(error.status);
}

/**
 * Cualquier fallo de la API de Clerk, transitorio o no. Se usa para decidir
 * qué se le enseña al usuario: la pantalla de "servicio no disponible" en
 * lugar de una redirección silenciosa al inicio de sesión.
 */
export function isClerkServiceError(error: unknown): boolean {
  return isClerkAPIResponseError(error);
}

/**
 * Resumen legible de un fallo de Clerk.
 *
 * `ClerkAPIResponseError` suele llegar con el `message` vacío —de ahí el
 * «An error occurred ... but no message was provided» que aparece en la
 * consola—, y todo el detalle útil vive en `status`, `clerkTraceId` y el
 * array `errors`. Sin volcarlos, el fallo es imposible de diagnosticar.
 */
export function describeClerkError(error: unknown): string | null {
  if (!isClerkAPIResponseError(error)) return null;

  const detail = error.errors
    ?.map((e) => [e.code, e.message, e.longMessage].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join(' | ');

  return [
    `Clerk API ${error.status ?? 'sin estado'}`,
    detail || error.message || 'sin detalle',
    error.clerkTraceId ? `traceId=${error.clerkTraceId}` : null,
    error.retryAfter ? `retryAfter=${error.retryAfter}s` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
