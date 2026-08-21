-- ============================================================================
-- Migración a Clerk como proveedor de identidad
-- ============================================================================
-- Estrategia: Clerk pasa a ser la fuente de verdad de la identidad, pero
-- `public.users.id` SIGUE SIENDO el UUID interno. Así ninguna FK existente
-- (transfers, balances, activity_logs, notifications...) se rompe y no se
-- pierde ni un solo registro histórico.
--
-- El puente entre ambos mundos es `public.users.clerk_user_id`.
--
-- IMPORTANTE: revisa y ejecuta esto en staging antes que en producción, y haz
-- copia de seguridad primero. Repunta claves foráneas y elimina un trigger.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. El trigger que duplicaba el aprovisionamiento desaparece.
--    Era la causa de "Database error saving new user": hacía un INSERT plano
--    en public.users dentro de la transacción de auth.users, y cualquier
--    colisión (phone UNIQUE) abortaba el alta entera.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Puente de identidad Clerk -> UUID interno
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_key
  ON public.users(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

ALTER TABLE public.developer_profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS developer_profiles_clerk_user_id_key
  ON public.developer_profiles(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. `public.users.id` deja de depender de auth.users.
--    Los usuarios nuevos ya no nacen en auth.users, así que el UUID lo genera
--    la propia tabla.
-- ----------------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ----------------------------------------------------------------------------
-- 4. Arreglo del teléfono (bug #3 del análisis previo).
--    NOT NULL + UNIQUE global hacía imposible registrar sin teléfono y
--    provocaba colisiones con la cadena vacía.
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key;

-- Normaliza cadenas vacías heredadas antes de crear el índice único parcial.
UPDATE public.users SET phone = NULL WHERE phone IS NOT NULL AND btrim(phone) = '';

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_not_null
  ON public.users(phone)
  WHERE phone IS NOT NULL;

-- `email` pasa a ser único: con Clerk siempre llega verificado y normalizado.
UPDATE public.users SET email = NULL WHERE email IS NOT NULL AND btrim(email) = '';
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_not_null
  ON public.users(lower(email))
  WHERE email IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. Toda identidad tiene fila en public.users (incluidos los desarrolladores).
--    Backfill previo a repuntar las FKs.
-- ----------------------------------------------------------------------------
INSERT INTO public.users (id, name, email, phone, role, is_active, is_verified, created_at, updated_at)
SELECT dp.user_id, dp.name, dp.email, dp.phone, 'cliente', TRUE, dp.is_verified, dp.created_at, dp.updated_at
FROM public.developer_profiles dp
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = dp.user_id)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Repuntar las FKs de auth.users -> public.users
-- ----------------------------------------------------------------------------
ALTER TABLE public.account_access DROP CONSTRAINT IF EXISTS account_access_user_id_fkey;
ALTER TABLE public.account_access
  ADD CONSTRAINT account_access_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.developer_profiles DROP CONSTRAINT IF EXISTS developer_profiles_user_id_fkey;
ALTER TABLE public.developer_profiles
  ADD CONSTRAINT developer_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_subscriptions DROP CONSTRAINT IF EXISTS webhook_subscriptions_user_id_fkey;
ALTER TABLE public.webhook_subscriptions
  ADD CONSTRAINT webhook_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 7. RLS
--    La aplicación accede a los datos exclusivamente con la service-role key
--    (lib/supabase/admin.ts), que ignora RLS. Las políticas basadas en
--    `auth.uid()` quedan inertes: ya no hay sesión de Supabase Auth, así que
--    `auth.uid()` devuelve NULL y DENIEGAN a anon/authenticated. Eso es
--    justo lo que queremos: fail-closed para cualquier acceso directo con la
--    anon key. La autorización real vive en lib/server/authz.ts.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.account_access FROM anon, authenticated;
REVOKE ALL ON public.developer_profiles FROM anon, authenticated;

COMMIT;
