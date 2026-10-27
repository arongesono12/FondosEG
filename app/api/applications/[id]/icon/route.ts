import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import { credentialRouteError, requireVisibleApplication } from '@/lib/server/credential-ownership';
import {
  APPLICATION_ICON_BUCKET,
  APPLICATION_ICON_MAX_BYTES,
  buildApplicationIconPath,
  detectApplicationIconType,
  ownedIconStoragePath,
} from '@/lib/server/application-icon-rules';
import { consumePublicEndpointRateLimit } from '@/lib/server/public-endpoint-security';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Icono de la aplicación. Lo gestiona quien gestiona la aplicación; se guarda
 * en el bucket público `application-icons` y su URL en `icon_url`.
 */

// Margen para las cabeceras del multipart: el fichero sigue limitado abajo.
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;
// Nombre único por subida, así que la caché nunca sirve un icono reemplazado;
// corta para que uno retirado deje de verse pronto.
const CACHE_SECONDS = '86400';
const UPLOADS_PER_HOUR = 20;
const RATE_LIMIT_WINDOW_MINUTES = 60;

const STORAGE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return null;
  }
})();

function invalid(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

async function removeStoredIcon(iconUrl: string | null | undefined, applicationId: string) {
  const path = ownedIconStoragePath(iconUrl, applicationId, STORAGE_ORIGIN);
  if (!path) return;
  const { error } = await createAdminClient().storage.from(APPLICATION_ICON_BUCKET).remove([path]);
  // No se bloquea el cambio por un objeto huérfano: solo ocupa espacio.
  if (error) console.error('Application icon cleanup failed:', error.message);
}

/**
 * Cambia `icon_url` solo si sigue siendo el que se leyó: dos cambios a la vez
 * no se pisan y el perdedor recibe 409 en lugar de dejar un objeto huérfano.
 */
async function swapIconUrl(applicationId: string, expected: string | null, next: string | null): Promise<boolean> {
  const query = createAdminClient()
    .from('api_applications')
    .update({ icon_url: next, updated_at: new Date().toISOString() })
    .eq('id', applicationId);
  const { data, error } = await (expected === null ? query.is('icon_url', null) : query.eq('icon_url', expected)).select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

const CONCURRENT_CHANGE = 'El icono cambió mientras se guardaba. Vuelve a intentarlo.';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const { id } = await context.params;
    const application = await requireVisibleApplication(id, user.id, access.access_role);

    // Sin longitud declarada no se lee el cuerpo: `formData()` lo cargaría
    // entero en memoria antes de poder medir el fichero.
    const declaredLength = Number(request.headers.get('content-length'));
    if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
      return invalid('Falta la longitud de la petición.', 411);
    }
    if (declaredLength > APPLICATION_ICON_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return invalid('El icono no debe superar los 512 KB.', 413);
    }

    const rateLimit = await consumePublicEndpointRateLimit(
      request,
      `application-icon:${user.id}`,
      UPLOADS_PER_HOUR,
      RATE_LIMIT_WINDOW_MINUTES
    );
    if (!rateLimit.allowed) {
      return invalid('Has cambiado el icono demasiadas veces. Inténtalo más tarde.', 429, {
        'Retry-After': String(rateLimit.retryAfterSeconds),
      });
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get('icon');
    if (!(file instanceof File) || file.size === 0) {
      return invalid('Selecciona una imagen para el icono.');
    }
    if (file.size > APPLICATION_ICON_MAX_BYTES) {
      return invalid('El icono no debe superar los 512 KB.', 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const iconType = detectApplicationIconType(bytes);
    if (!iconType) {
      return invalid('El icono debe ser una imagen PNG, JPG o WebP.');
    }

    const adminClient = createAdminClient();
    const path = buildApplicationIconPath(application.id, iconType.extension, randomUUID());
    const { error: uploadError } = await adminClient.storage
      .from(APPLICATION_ICON_BUCKET)
      .upload(path, bytes, { contentType: iconType.mime, cacheControl: CACHE_SECONDS, upsert: false });

    if (uploadError) {
      console.error('Application icon upload failed:', uploadError.message);
      const missingBucket = /bucket not found/i.test(uploadError.message);
      return invalid(
        missingBucket
          ? 'Falta aplicar la migración 20261027_api_application_icons.sql en la base de datos'
          : 'No se pudo subir el icono.',
        missingBucket ? 503 : 500
      );
    }

    const { data: { publicUrl } } = adminClient.storage.from(APPLICATION_ICON_BUCKET).getPublicUrl(path);

    let swapped = false;
    try {
      swapped = await swapIconUrl(application.id, application.icon_url, publicUrl);
    } finally {
      if (!swapped) await removeStoredIcon(publicUrl, application.id);
    }
    if (!swapped) return invalid(CONCURRENT_CHANGE, 409);

    await removeStoredIcon(application.icon_url, application.id);
    return NextResponse.json({ success: true, icon_url: publicUrl });
  } catch (error) {
    return credentialRouteError(error, 'Application icon POST');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const { id } = await context.params;
    const application = await requireVisibleApplication(id, user.id, access.access_role);

    if (!application.icon_url) return NextResponse.json({ success: true });
    if (!(await swapIconUrl(application.id, application.icon_url, null))) {
      return invalid(CONCURRENT_CHANGE, 409);
    }

    await removeStoredIcon(application.icon_url, application.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return credentialRouteError(error, 'Application icon DELETE');
  }
}
