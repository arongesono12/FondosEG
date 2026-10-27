/**
 * Reglas del icono de una aplicación de integrador.
 *
 * El icono se sirve desde un bucket público, así que el tipo se decide por el
 * contenido del fichero y nunca por la extensión ni por el `Content-Type` que
 * declara el navegador. Solo imágenes rasterizadas: un SVG puede llevar
 * scripts y quedaría alojado en un dominio de confianza.
 *
 * Sin imports con alias: lo cargan las rutas y los tests de `node --test`.
 */

export const APPLICATION_ICON_BUCKET = 'application-icons';

/** Igual que `file_size_limit` del bucket (migración 20261027). */
export const APPLICATION_ICON_MAX_BYTES = 524288;

export interface ApplicationIconType {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_NAME_PATTERN = /^[a-z0-9-]{1,64}\.(png|jpg|webp)$/i;
const TOKEN_PATTERN = /^[a-z0-9-]{1,64}$/i;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export function detectApplicationIconType(bytes: Uint8Array): ApplicationIconType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return { mime: 'image/png', extension: 'png' };
  if (startsWith(bytes, JPEG_SIGNATURE)) return { mime: 'image/jpeg', extension: 'jpg' };
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return { mime: 'image/webp', extension: 'webp' };
  return null;
}

/**
 * `<aplicación>/<token>.<ext>`. Nombre único por subida: la URL pública cambia
 * con cada icono y ninguna caché sirve el anterior.
 */
export function buildApplicationIconPath(
  applicationId: string,
  extension: ApplicationIconType['extension'],
  token: string
): string {
  if (!UUID_PATTERN.test(applicationId)) throw new Error('Invalid application id');
  if (!TOKEN_PATTERN.test(token)) throw new Error('Invalid icon token');
  return `${applicationId}/${token}.${extension}`;
}

/**
 * Ruta en Storage del icono guardado, solo si está en el Supabase del
 * proyecto (`storageOrigin`) y en la carpeta de ESTA aplicación. Así un
 * `icon_url` manipulado nunca lleva a borrar el objeto de otra.
 */
export function ownedIconStoragePath(
  iconUrl: string | null | undefined,
  applicationId: string,
  storageOrigin: string | null
): string | null {
  if (!iconUrl || !storageOrigin || !UUID_PATTERN.test(applicationId)) return null;

  let pathname: string;
  try {
    const url = new URL(iconUrl);
    if (url.origin !== new URL(storageOrigin).origin) return null;
    pathname = url.pathname;
  } catch {
    return null;
  }

  const marker = `/${APPLICATION_ICON_BUCKET}/`;
  const index = pathname.indexOf(marker);
  if (index === -1) return null;

  const [folder, objectName, ...rest] = pathname.slice(index + marker.length).split('/');
  if (rest.length > 0 || folder !== applicationId || !OBJECT_NAME_PATTERN.test(objectName ?? '')) return null;
  return `${folder}/${objectName}`;
}
