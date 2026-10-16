-- ---------------------------------------------------------------------------
-- Credenciales y webhooks emitidos por un administrador a nombre de un cliente
-- ---------------------------------------------------------------------------
--
-- `user_id` sigue siendo el TITULAR: la billetera cuyo saldo opera la API key
-- y la que recibe los eventos del webhook. `issued_by_user_id` guarda qué
-- administrador la emitió desde el portal de desarrolladores, para que pueda
-- verla, rotarla y revocarla aunque no sea el titular. NULL = emitida por el
-- propio titular (todas las filas anteriores a esta migración).
--
-- Sin FK a `public.users`: desde 20260718 las identidades solo-desarrollador
-- no tienen fila en `users`, y `api_keys.user_id` ya funciona igual.

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS issued_by_user_id UUID;

ALTER TABLE public.webhook_subscriptions
  ADD COLUMN IF NOT EXISTS issued_by_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_api_keys_issued_by
  ON public.api_keys (issued_by_user_id)
  WHERE issued_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_issued_by
  ON public.webhook_subscriptions (issued_by_user_id)
  WHERE issued_by_user_id IS NOT NULL;
