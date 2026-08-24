-- ============================================================================
-- Repunte de claves foráneas: `auth.users` -> `public.users`
-- ============================================================================
--
-- SÍNTOMA
--
-- El envío entre clientes falla SIEMPRE con «No se pudo registrar la
-- transferencia. Inténtalo de nuevo.» y `wallet_transfers` no llega a tener
-- ni una fila. Ese texto es el mensaje de reserva de `translateRpcError()`
-- en `services/wallet-transfer.ts`: la RPC `create_wallet_transfer_hold`
-- aborta con un error que su tabla de traducción no reconoce, así que el
-- emisor recibe un «inténtalo de nuevo» ante un fallo que no se arregla
-- reintentando nunca.
--
-- CAUSA
--
-- El error real de PostgreSQL, capturado invocando la RPC con datos reales:
--
--   23503: insert or update on table "wallet_transfers" violates foreign key
--          constraint "wallet_transfers_sender_id_fkey"
--   DETAIL: Key (sender_id)=(2032b40b-…) is not present in table "users".
--
-- Ese UUID SÍ está en `public.users`. Lo que ocurre es que las claves foráneas
-- de la tabla desplegada apuntan a `auth.users`, no a `public.users`. Desde
-- `20260821_clerk_identity_migration.sql` la identidad la gobierna Clerk y los
-- usuarios nuevos nacen SÓLO en `public.users` (`id` lo genera
-- `gen_random_uuid()`), de modo que no tienen fila en `auth.users` y la
-- restricción los rechaza.
--
-- En el entorno real, en el momento de escribir esta migración, 2 de los 9
-- usuarios son posteriores a Clerk. Para ellos el envío de billetera es
-- imposible tanto de emisores como de beneficiarios, y el problema crece con
-- cada alta nueva: todo usuario creado a partir de ahora nace roto.
--
-- Afecta a los dos caminos que insertan en la tabla:
-- `create_wallet_transfer_hold` (panel) y
-- `create_wallet_transfer_direct_operation` (API de integradores).
--
-- POR QUÉ NO LO CORRIGIÓ NINGUNA MIGRACIÓN ANTERIOR
--
--   * `20260821_clerk_identity_migration.sql` repunta a mano las FK de
--     `account_access`, `developer_profiles`, `api_keys` y
--     `webhook_subscriptions`. No la de `wallet_transfers`: el repositorio la
--     declara contra `public.users` desde
--     `20240326_create_wallet_transfers.sql`, así que nadie sospechó de ella.
--     El esquema desplegado divergía —eso ya lo documenta
--     `20260822_wallet_transfers_schema_convergence.sql`—, sólo que la
--     divergencia no era «no existen las FK» sino «existen y apuntan a otra
--     tabla».
--
--   * `20260822_wallet_transfers_schema_convergence.sql` sí intenta crearlas
--     contra `public.users`, pero su guarda es por NOMBRE
--     (`conname = 'wallet_transfers_sender_id_fkey'`). La restricción ya
--     existía —apuntando a `auth.users`—, de modo que el bloque entero quedó
--     en nada. Comprobar el nombre no dice a dónde apunta.
--
-- QUÉ HACE ESTA MIGRACIÓN
--
--   1. Repunta TODAS las FK de una sola columna del esquema `public` que aún
--      referencian `auth.users`, conservando su acción ON DELETE. Es un
--      barrido y no una lista a mano a propósito: la lista a mano es
--      exactamente lo que dejó fuera a `wallet_transfers` en 20260821.
--   2. Se asegura de que `wallet_transfers` acaba con sus dos FK hacia
--      `public.users`, comprobando la tabla DESTINO y no el nombre.
--   3. Verifica el resultado y ABORTA si algo sigue mal. Un no-op silencioso
--      es justo lo que mantuvo vivo este fallo.
--
-- SEGURIDAD DE APLICACIÓN
--
-- Antes de tocar cada restricción se cuentan las filas huérfanas (valores que
-- no existen en `public.users`). Si las hay, esa restricción se deja como
-- está y se emite un WARNING con el recuento: nunca se cambia una FK que
-- fuese a fallar la validación ni se elimina integridad sin sustituirla.
-- `wallet_transfers` tenía 0 filas al escribir esto, así que su repunte no
-- puede fallar por datos.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente: aplicarla dos veces
-- no cambia nada la segunda vez.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Barrido: cualquier FK de `public` que aún mire a `auth.users`
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_orphans BIGINT;
  v_on_delete TEXT;
  v_repointed INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  FOR r IN
    SELECT
      c.conname,
      ns.nspname   AS schema_name,
      rel.relname  AS table_name,
      att.attname  AS column_name,
      c.confdeltype
    FROM pg_constraint c
    JOIN pg_class rel      ON rel.oid = c.conrelid
    JOIN pg_namespace ns   ON ns.oid = rel.relnamespace
    JOIN pg_attribute att  ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND c.confrelid = 'auth.users'::regclass
      -- Sólo FK de una columna: las compuestas no existen aquí y tratarlas a
      -- ciegas sería adivinar.
      AND array_length(c.conkey, 1) = 1
    ORDER BY rel.relname, att.attname
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I t WHERE t.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = t.%I)',
      r.schema_name, r.table_name, r.column_name, r.column_name
    ) INTO v_orphans;

    IF v_orphans > 0 THEN
      v_skipped := v_skipped + 1;
      RAISE WARNING
        'SIN TOCAR %.%.% (%): % fila(s) apuntan a un usuario que no está en public.users. Reconcilia esos datos y vuelve a ejecutar.',
        r.schema_name, r.table_name, r.column_name, r.conname, v_orphans;
      CONTINUE;
    END IF;

    v_on_delete := CASE r.confdeltype
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'd' THEN 'SET DEFAULT'
      ELSE 'NO ACTION'
    END;

    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                   r.schema_name, r.table_name, r.conname);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE %s',
                   r.schema_name, r.table_name, r.conname, r.column_name, v_on_delete);

    v_repointed := v_repointed + 1;
    RAISE NOTICE 'Repuntada %.%.% -> public.users(id) ON DELETE %',
      r.schema_name, r.table_name, r.column_name, v_on_delete;
  END LOOP;

  RAISE NOTICE 'Claves foráneas repuntadas: %. Omitidas por huérfanos: %.', v_repointed, v_skipped;
END $$;

-- ---------------------------------------------------------------------------
-- 2. `wallet_transfers`: garantizar las dos FK hacia `public.users`
-- ---------------------------------------------------------------------------
--
-- El paso 1 cubre el caso real (existían mal apuntadas). Este paso cubre el
-- caso en el que no existieran en absoluto, que es lo que creía
-- `20260822_wallet_transfers_schema_convergence.sql`. La comprobación es por
-- COLUMNA Y TABLA DESTINO, nunca por nombre: ese fue el error de aquella
-- guarda.
--
-- `ON DELETE SET NULL` conserva el histórico aunque se borre la cuenta: los
-- campos desnormalizados (`sender_name`, `sender_phone`, `receiver_name`,
-- `receiver_phone`) siguen documentando quién era cada parte.

DO $$
DECLARE
  v_column TEXT;
  v_constraint TEXT;
  v_orphans BIGINT;
BEGIN
  FOREACH v_column IN ARRAY ARRAY['sender_id', 'receiver_id'] LOOP
    v_constraint := 'wallet_transfers_' || v_column || '_fkey';

    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.conrelid = 'public.wallet_transfers'::regclass
        AND c.confrelid = 'public.users'::regclass
        AND att.attname = v_column
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.wallet_transfers t WHERE t.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = t.%I)',
      v_column, v_column
    ) INTO v_orphans;

    IF v_orphans > 0 THEN
      RAISE WARNING 'wallet_transfers.% tiene % fila(s) huérfana(s): no se crea la clave foránea.', v_column, v_orphans;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.wallet_transfers DROP CONSTRAINT IF EXISTS %I', v_constraint);
    EXECUTE format(
      'ALTER TABLE public.wallet_transfers ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE SET NULL',
      v_constraint, v_column
    );
    RAISE NOTICE 'Creada %  (%)', v_constraint, v_column;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Verificación: abortar si el fallo original sigue en pie
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_still_auth TEXT;
  v_column TEXT;
BEGIN
  SELECT string_agg(c.conname, ', ')
  INTO v_still_auth
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.wallet_transfers'::regclass
    AND c.confrelid = 'auth.users'::regclass;

  IF v_still_auth IS NOT NULL THEN
    RAISE EXCEPTION
      'wallet_transfers sigue con claves foráneas hacia auth.users (%). Revisa los WARNING de filas huérfanas.',
      v_still_auth;
  END IF;

  FOREACH v_column IN ARRAY ARRAY['sender_id', 'receiver_id'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.conrelid = 'public.wallet_transfers'::regclass
        AND c.confrelid = 'public.users'::regclass
        AND att.attname = v_column
    ) THEN
      RAISE EXCEPTION 'wallet_transfers.% se ha quedado sin clave foránea hacia public.users', v_column;
    END IF;
  END LOOP;

  RAISE NOTICE 'OK: wallet_transfers.sender_id y .receiver_id referencian public.users(id).';
END $$;

COMMIT;

-- ============================================================================
-- COMPROBACIÓN MANUAL (opcional, tras aplicar)
--
--   SELECT c.conname,
--          c.conrelid::regclass  AS tabla,
--          c.confrelid::regclass AS referencia
--   FROM pg_constraint c
--   JOIN pg_class rel    ON rel.oid = c.conrelid
--   JOIN pg_namespace ns ON ns.oid = rel.relnamespace
--   WHERE c.contype = 'f' AND ns.nspname = 'public'
--     AND c.confrelid = 'auth.users'::regclass;
--
-- Debe devolver 0 filas.
-- ============================================================================
