-- ============================================================================
-- Avatar de perfil y reconciliación con Clerk
-- ============================================================================
-- `public.users.avatar_url` ya se usaba en el código (imageUrl de Clerk/Google
-- en el alta, subida a Supabase Storage desde el perfil) pero nunca se declaró
-- en el esquema, así que en bases construidas desde los scripts del repo toda
-- escritura fallaba (PGRST204) y el avatar nunca se veía. Este paso la añade
-- de forma idempotente.
--
-- También añade `clerk_synced_at`: fecha de la última comprobación de la
-- identidad contra Clerk. Permite reconciliar el avatar sin llamar al Backend
-- API de Clerk en cada carga del dashboard (throttle, ver
-- lib/server/clerk-identity.ts).
--
-- Y materializa el bucket público `avatars` + política de lectura anónima para
-- que las URLs públicas generadas por la app rendericen en el <img>.
-- ============================================================================

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.users.avatar_url
  IS 'URL pública del avatar: imageUrl de Clerk (cuenta Google) o Supabase Storage (bucket avatars).';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS clerk_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.clerk_synced_at
  IS 'Última comprobación de identidad contra Clerk (throttle de la reconciliación).';

-- Bucket público e idempotente para los avatares subidos a mano.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Política expresa de lectura anónima para los objetos del bucket.
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;

CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

COMMIT;