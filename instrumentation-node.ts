import { isWebhookEncryptionConfigured } from './lib/server/webhook-security';

/**
 * Comprobaciones de arranque que solo pueden correr en Node (usan `crypto`).
 * Se carga desde `instrumentation.ts` únicamente en el runtime `nodejs`.
 *
 * No detiene el arranque —el resto de la aplicación funciona sin webhooks—,
 * pero deja un aviso visible en los logs del despliegue en vez de descubrirlo
 * cuando un usuario recibe un error al crear un webhook.
 */
if (!isWebhookEncryptionConfigured()) {
  console.error(
    '[config] WEBHOOK_ENCRYPTION_KEY falta o no tiene 32 bytes. Crear o rotar webhooks ' +
      'responderá 503 y las entregas quedarán en cola. Genera una con `openssl rand -hex 32` ' +
      'y defínela en las variables de entorno del servidor (mantenla estable: si cambia, ' +
      'los secretos ya guardados dejan de poder descifrarse).'
  );
}
