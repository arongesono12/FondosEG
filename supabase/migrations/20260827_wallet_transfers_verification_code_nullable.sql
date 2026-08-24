-- ============================================================================
-- `wallet_transfers.verification_code` vuelve a admitir NULL
-- ============================================================================
--
-- SÍNTOMA
--
--   null value in column "verification_code" of relation "wallet_transfers"
--   violates not-null constraint (23502)
--
-- Falla al enviar entre clientes desde el panel, dentro de
-- `create_wallet_transfer_settled_operation`, en el INSERT de la orden.
--
-- CAUSA
--
-- La tabla desplegada no se creó con `20240326_create_wallet_transfers.sql`,
-- como ya documenta `20260822_wallet_transfers_schema_convergence.sql`: se creó
-- por otra vía y divergió. Aquella migración declara
--
--   verification_code TEXT      -- admite NULL
--
-- pero la columna real quedó como NOT NULL. Mientras el envío entre clientes
-- fue un vale al portador daba igual: `create_wallet_transfer_operation`
-- siempre generaba un código de 6 dígitos, así que nunca se insertaba NULL.
--
-- `20260826_wallet_transfer_instant_settlement.sql` cambió el modelo: el envío
-- entre dos cuentas de la aplicación se liquida en el acto y NO tiene código
-- que presentar, de modo que la orden nace con `verification_code = NULL`. Ese
-- NULL choca contra una restricción que el repositorio nunca declaró y que sólo
-- existe en el esquema desplegado.
--
-- POR QUÉ SE QUITA LA RESTRICCIÓN Y NO SE INVENTA UN CÓDIGO
--
-- Rellenar la columna con un valor cualquiera para esquivar el error crearía un
-- código que no verifica nada y que además se indexa junto a los que sí son
-- vales reales. La ausencia de código es el dato: distingue el envío liquidado
-- en el acto del vale al portador. El código sigue siendo obligatorio de hecho
-- donde tiene sentido —`client_withdrawals`, donde quien presenta el código es
-- quien cobra—, y allí lo genera la propia función, no una restricción de esta
-- tabla.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

BEGIN;

ALTER TABLE public.wallet_transfers
  ALTER COLUMN verification_code DROP NOT NULL;

-- Un DEFAULT heredado del esquema divergente reintroduciría el código falso por
-- la puerta de atrás en cualquier INSERT que no nombre la columna.
ALTER TABLE public.wallet_transfers
  ALTER COLUMN verification_code DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- Comprobación
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_not_null BOOLEAN;
BEGIN
  SELECT attnotnull INTO v_not_null
  FROM pg_attribute
  WHERE attrelid = 'public.wallet_transfers'::regclass
    AND attname = 'verification_code'
    AND NOT attisdropped;

  IF v_not_null IS NULL THEN
    RAISE EXCEPTION 'No existe wallet_transfers.verification_code';
  END IF;

  IF v_not_null THEN
    RAISE EXCEPTION 'wallet_transfers.verification_code sigue siendo NOT NULL';
  END IF;

  RAISE NOTICE 'OK: wallet_transfers.verification_code admite NULL.';
END $$;

COMMIT;

-- ============================================================================
-- COMPROBACIÓN MANUAL (opcional, tras aplicar)
--
--   SELECT is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name = 'wallet_transfers'
--     AND column_name = 'verification_code';
--   -- Debe devolver is_nullable = YES y column_default = NULL.
--
--   -- Tras un envío nuevo desde el panel:
--   SELECT status, verification_code, reserved_at, expires_at, confirmed_at
--   FROM public.wallet_transfers ORDER BY created_at DESC LIMIT 5;
--   -- confirmed / NULL / NULL / NULL / con marca temporal.
-- ============================================================================
