/**
 * Clasificación de errores de Postgres devueltos por una RPC.
 *
 * Una RPC de PostgREST corre en una única transacción. Si Postgres responde
 * con una excepción propia (`RAISE EXCEPTION` → P0001), un error de datos
 * (clase 22) o una violación de integridad (clase 23), la transacción entera
 * se revirtió: no se movió dinero y es seguro permitir un reintento.
 *
 * Cualquier otra cosa (corte de red, timeout, error sin código) es ambigua:
 * la transacción pudo confirmarse sin que llegara la respuesta.
 */
export function isDefinitiveDatabaseRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return false;
  return code === 'P0001' || /^2[23][0-9A-Z]{3}$/.test(code);
}
