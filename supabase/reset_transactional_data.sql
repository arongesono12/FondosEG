-- ============================================================================
-- Vaciado de datos transaccionales — FondosEG
-- ============================================================================
--
-- QUÉ HACE
--
-- Borra TODO el dinero y todo el historial de movimientos, y deja intactos los
-- usuarios, sus roles y su acceso a la aplicación. Sirve para dejar un entorno
-- limpio conservando las cuentas ya dadas de alta.
--
-- ESTO NO ES UNA MIGRACIÓN. No lo pongas en `supabase/migrations/`: se ejecuta
-- a mano, cuando tú lo decides. Si acabara en la carpeta de migraciones se
-- aplicaría solo en cada despliegue y vaciaría producción.
--
-- ES IRREVERSIBLE. No hay papelera ni deshacer. Haz una copia antes:
--
--   supabase db dump --data-only -f respaldo-$(date +%F).sql
--
-- ENSAYO EN SECO (recomendado la primera vez)
--
-- Cambia el `COMMIT;` del final por `ROLLBACK;`. El script se ejecuta entero,
-- imprime exactamente qué habría borrado y luego lo deshace todo. Cuando el
-- recuento te cuadre, vuelve a poner `COMMIT;` y ejecútalo de verdad.
--
-- CÓMO EJECUTARLO
--
--   * Supabase Studio -> SQL Editor -> pegar y ejecutar.
--   * O bien: psql "$DATABASE_URL" -f supabase/reset_transactional_data.sql
--
-- Los avisos (`NOTICE`) con el recuento salen en la pestaña de mensajes del
-- editor, o directamente en la terminal con psql.
--
-- ============================================================================
--
-- SE CONSERVA
--
--   users                     Las cuentas y su rol (admin, gestor, cliente).
--   account_access            El permiso de entrada a cada producto. Sin esto,
--                             los usuarios conservados no podrían ni iniciar
--                             sesión: forma parte de "los usuarios y sus roles".
--   developer_profiles        Identidad del portal de desarrolladores.
--   financial_pricing_rules   Tarifas. Es configuración, no un movimiento.
--   agent_balances            La FILA se conserva; el importe se pone a cero.
--   client_balances           Igual: se conserva la fila y se pone a cero.
--   api_keys                  Credenciales de integración (ver bloque opcional).
--   webhook_subscriptions     Suscripciones de integración (ver bloque opcional).
--   properties / rentals      Catálogo y contratos (ver bloque opcional).
--
-- SE VACÍA
--
--   Envíos, retiros, órdenes de billetera, asientos contables, eventos
--   financieros, registro de actividad, notificaciones y su bandeja de salida,
--   evidencias de cumplimiento, pagos de alquiler y sus callbacks, entregas de
--   webhook y todo el registro de uso de la API pública.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Recuento previo
-- ---------------------------------------------------------------------------
--
-- Se imprime ANTES de borrar. Es lo que te permite comprobar en el ensayo en
-- seco que el alcance es el que esperas.

DO $$
DECLARE
  v_table TEXT;
  v_count BIGINT;
  v_total BIGINT := 0;
  v_tables TEXT[] := ARRAY[
    'transfers',
    'wallet_transfers',
    'client_withdrawals',
    'balance_transactions',
    'financial_events',
    'activity_logs',
    'notifications',
    'notification_outbox',
    'compliance_events',
    'payment_provider_events',
    'rental_payments',
    'webhook_deliveries',
    'api_request_logs',
    'api_key_usage_windows',
    'api_idempotency_keys',
    'public_endpoint_rate_limits'
  ];
BEGIN
  RAISE NOTICE '--- Filas que se van a borrar ---';
  FOREACH v_table IN ARRAY v_tables LOOP
    -- El esquema desplegado ha divergido del repositorio antes (ver
    -- `20260822_wallet_transfers_schema_convergence.sql`), así que nunca se da
    -- por hecho que una tabla exista: si falta, se informa y se sigue.
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE NOTICE '  % -> no existe en esta base de datos, se omite', v_table;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT COUNT(*) FROM public.%I', v_table) INTO v_count;
    v_total := v_total + v_count;
    RAISE NOTICE '  % -> % filas', v_table, v_count;
  END LOOP;
  RAISE NOTICE '--- Total: % filas ---', v_total;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Vaciado
-- ---------------------------------------------------------------------------
--
-- Un único TRUNCATE con todas las tablas a la vez: así el orden de las claves
-- foráneas dentro del grupo deja de importar. Deliberadamente SIN `CASCADE`:
-- si alguna tabla que no está en la lista apuntase aquí dentro, se prefiere que
-- falle de forma ruidosa (y que la transacción entera se deshaga) antes que
-- arrastrar en silencio datos que nadie pidió borrar.
--
-- El grupo está cerrado: quienes referencian a estas tablas están todos dentro
-- (notifications -> transfers, notification_outbox -> notifications,
-- payment_provider_events -> rental_payments), y las tablas que SÍ se conservan
-- (`api_keys`, `webhook_subscriptions`) sólo son referenciadas desde dentro del
-- grupo, nunca al revés.

DO $$
DECLARE
  v_table TEXT;
  v_existing TEXT[] := ARRAY[]::TEXT[];
  v_tables TEXT[] := ARRAY[
    -- Dinero y sus documentos
    'transfers',
    'wallet_transfers',
    'client_withdrawals',
    -- Contabilidad y auditoría
    'balance_transactions',
    'financial_events',
    'activity_logs',
    'compliance_events',
    -- Avisos
    'notification_outbox',
    'notifications',
    -- Producto de alquileres: los PAGOS, no los contratos
    'rental_payments',
    'payment_provider_events',
    -- Integraciones: el historial de uso, no las credenciales
    'webhook_deliveries',
    'api_request_logs',
    'api_key_usage_windows',
    'api_idempotency_keys',
    'public_endpoint_rate_limits'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      v_existing := array_append(v_existing, format('public.%I', v_table));
    END IF;
  END LOOP;

  IF array_length(v_existing, 1) IS NULL THEN
    RAISE NOTICE 'No se ha encontrado ninguna tabla transaccional. Nada que hacer.';
    RETURN;
  END IF;

  EXECUTE 'TRUNCATE TABLE ' || array_to_string(v_existing, ', ') || ' RESTART IDENTITY';
  RAISE NOTICE 'Vaciadas % tablas transaccionales.', array_length(v_existing, 1);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Saldos a cero
-- ---------------------------------------------------------------------------
--
-- Este paso NO es opcional. Borrar los asientos y dejar los saldos en pie
-- dejaría la base de datos mintiendo: dinero sin ningún movimiento que lo
-- explique, y una conciliación que no cuadra desde el primer día.
--
-- Se actualiza en lugar de borrar la fila para conservar la divisa de cada
-- billetera y no perder el vínculo con el usuario. (Si prefieres eliminarlas,
-- las funciones las vuelven a crear solas con `ON CONFLICT DO NOTHING`, pero
-- perderías la divisa configurada.)
--
-- Las columnas se comprueban una a una porque `cash_balance` y
-- `reserved_balance` llegaron en migraciones posteriores y podrían no estar
-- presentes en un entorno que se haya quedado atrás.

DO $$
DECLARE
  v_sets TEXT;
  v_updated BIGINT;
BEGIN
  IF to_regclass('public.agent_balances') IS NOT NULL THEN
    v_sets := 'balance = 0';

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agent_balances' AND column_name = 'cash_balance'
    ) THEN
      v_sets := v_sets || ', cash_balance = 0';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'agent_balances' AND column_name = 'updated_at'
    ) THEN
      v_sets := v_sets || ', updated_at = NOW()';
    END IF;

    EXECUTE 'UPDATE public.agent_balances SET ' || v_sets;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Saldos de gestor puestos a cero: % filas', v_updated;
  END IF;

  IF to_regclass('public.client_balances') IS NOT NULL THEN
    v_sets := 'balance = 0';

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'client_balances' AND column_name = 'reserved_balance'
    ) THEN
      v_sets := v_sets || ', reserved_balance = 0';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'client_balances' AND column_name = 'updated_at'
    ) THEN
      v_sets := v_sets || ', updated_at = NOW()';
    END IF;

    EXECUTE 'UPDATE public.client_balances SET ' || v_sets;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Saldos de cliente puestos a cero: % filas', v_updated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Bloques opcionales
-- ---------------------------------------------------------------------------
--
-- Nada de esto es un movimiento de dinero, así que por defecto se conserva.
-- Descomenta sólo lo que quieras eliminar de verdad.

-- (a) Catálogo de alquileres: inmuebles y contratos.
--     Sus PAGOS ya se han borrado arriba; esto elimina además los contratos y
--     las fichas de inmueble.
-- TRUNCATE TABLE public.rentals, public.properties RESTART IDENTITY CASCADE;

-- (b) Credenciales de integración: claves de API y suscripciones de webhook.
--     Al borrarlas, toda integración externa deja de autenticar al instante.
-- TRUNCATE TABLE public.api_keys RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE public.webhook_subscriptions RESTART IDENTITY CASCADE;

-- (c) Bandeja de soporte: los mensajes recibidos por correo.
-- TRUNCATE TABLE public.support_messages RESTART IDENTITY;

-- (d) Tokens de verificación de correo (heredado de antes de Clerk).
-- TRUNCATE TABLE public.email_verification RESTART IDENTITY;

-- (e) Perfiles del portal de desarrolladores.
--     OJO: es identidad, no historial. Borrarlo expulsa a esos usuarios del
--     portal aunque su fila en `users` siga existiendo.
-- TRUNCATE TABLE public.developer_profiles RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Comprobación final
-- ---------------------------------------------------------------------------
--
-- Lo que se conserva, con sus recuentos. Si algo aquí sale a 0 cuando no
-- debería, cambia el COMMIT por ROLLBACK y revisa antes de confirmar.
--
-- Va en un bloque con guardas por la misma razón que el resto del script: una
-- tabla ausente aquí abortaría la transacción y tiraría por tierra un vaciado
-- que ya había ido bien. `account_access`, sin ir más lejos, puede no existir:
-- `lib/server/authz.ts` contempla explícitamente ese caso.

DO $$
DECLARE
  v_table TEXT;
  v_value TEXT;
BEGIN
  RAISE NOTICE '--- Estado final ---';

  FOR v_table, v_value IN
    SELECT 'usuarios', COUNT(*)::TEXT FROM public.users
    UNION ALL
    SELECT '  rol ' || role, COUNT(*)::TEXT FROM public.users GROUP BY role
  LOOP
    RAISE NOTICE '  % -> %', v_table, v_value;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'account_access',
    'transfers',
    'wallet_transfers',
    'client_withdrawals',
    'balance_transactions',
    'financial_events',
    'activity_logs'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT COUNT(*)::TEXT FROM public.%I', v_table) INTO v_value;
    RAISE NOTICE '  % -> % filas', v_table, v_value;
  END LOOP;

  IF to_regclass('public.agent_balances') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(SUM(balance), 0)::TEXT FROM public.agent_balances' INTO v_value;
    RAISE NOTICE '  float total de gestores -> %', v_value;
  END IF;

  IF to_regclass('public.client_balances') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(SUM(balance), 0)::TEXT FROM public.client_balances' INTO v_value;
    RAISE NOTICE '  saldo total de clientes -> %', v_value;
  END IF;
END $$;

-- Rejilla de resultados visible en el editor SQL: `users` siempre existe.
SELECT role AS rol, COUNT(*) AS usuarios
FROM public.users
GROUP BY role
ORDER BY role;

-- Cambia esta línea por `ROLLBACK;` para hacer un ensayo en seco.
COMMIT;
