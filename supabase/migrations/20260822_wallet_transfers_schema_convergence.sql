-- ============================================================================
-- Convergencia de esquema de `wallet_transfers`
-- ============================================================================
--
-- CONTEXTO
--
-- La tabla `wallet_transfers` desplegada no se creó con
-- `20240326_create_wallet_transfers.sql`: se creó por otra vía y divergió.
-- Diferencias observadas contra el entorno real:
--
--   * NO existen las claves foráneas `wallet_transfers_sender_id_fkey` ni
--     `wallet_transfers_receiver_id_fkey`. `sender_id` y `receiver_id` son UUID
--     sueltos, sin integridad referencial. Cualquier consulta que usara el embed
--     `users!wallet_transfers_sender_id_fkey(...)` fallaba con PGRST200, lo que
--     dejaba inservibles la confirmación y el listado de pendientes.
--   * NO existe la columna `cancelled_at`, que sí declara aquella migración.
--   * SÍ existen columnas que aquella migración no declara (`reserved_at`,
--     `released_at`, `origin_channel`), procedentes de migraciones posteriores.
--
-- Esta migración es OPCIONAL para que el flujo funcione: `services/wallet-transfer.ts`
-- ya no depende de los embeds por clave foránea y resuelve las partes con una
-- consulta explícita. Se aplica por integridad referencial y para que el
-- esquema real deje de mentir respecto al repositorio.
--
-- SEGURIDAD DE APLICACIÓN: en el momento de escribirla, `wallet_transfers`
-- contiene 0 filas, así que la validación de las FK no puede fallar por datos
-- huérfanos. Si se aplica más tarde sobre una tabla con datos, revisar antes:
--
--   SELECT COUNT(*) FROM public.wallet_transfers wt
--   LEFT JOIN public.users u ON u.id = wt.sender_id
--   WHERE wt.sender_id IS NOT NULL AND u.id IS NULL;
--
-- ============================================================================

-- 1. Marca temporal de anulación -------------------------------------------
--
-- `cancelWalletTransfer` sólo escribe `status` porque esta columna no existe.
-- Tras aplicar la migración, conviene volver a escribir también `cancelled_at`
-- para no perder la trazabilidad regulatoria de la anulación.

ALTER TABLE public.wallet_transfers
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Integridad referencial hacia `users` -----------------------------------
--
-- `ON DELETE SET NULL` conserva el histórico de la transferencia aunque se
-- borre la cuenta: los campos desnormalizados `sender_name` / `sender_phone` /
-- `receiver_name` / `receiver_phone` siguen documentando quién era cada parte.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transfers_sender_id_fkey'
      AND conrelid = 'public.wallet_transfers'::regclass
  ) THEN
    ALTER TABLE public.wallet_transfers
      ADD CONSTRAINT wallet_transfers_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transfers_receiver_id_fkey'
      AND conrelid = 'public.wallet_transfers'::regclass
  ) THEN
    ALTER TABLE public.wallet_transfers
      ADD CONSTRAINT wallet_transfers_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Índices de apoyo --------------------------------------------------------
--
-- `getPendingWalletTransfers` filtra por (receiver_id, status) y
-- `getClientWalletTransfers` por sender_id/receiver_id.

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_sender_id
  ON public.wallet_transfers(sender_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_receiver_status
  ON public.wallet_transfers(receiver_id, status);
