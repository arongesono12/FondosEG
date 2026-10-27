-- ============================================================================
-- Icono de las aplicaciones de integradores
-- ============================================================================
--
-- Cada aplicación del portal de desarrolladores puede llevar un icono para
-- reconocerla de un vistazo. Se sube al bucket público `application-icons`,
-- en la carpeta `<api_applications.id>/`, y su URL pública se guarda en
-- `api_applications.icon_url`.
--
-- Solo PNG, JPEG o WebP de hasta 512 KB (524288 bytes). Sin SVG: puede llevar
-- scripts. La app valida además el contenido real del fichero
-- (lib/server/application-icon-rules.ts); el bucket es la segunda barrera.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

BEGIN;

ALTER TABLE public.api_applications
  ADD COLUMN IF NOT EXISTS icon_url TEXT;

ALTER TABLE public.api_applications
  DROP CONSTRAINT IF EXISTS api_applications_icon_url_check;

ALTER TABLE public.api_applications
  ADD CONSTRAINT api_applications_icon_url_check
  CHECK (icon_url IS NULL OR (icon_url LIKE 'https://%' AND char_length(icon_url) <= 1000));

COMMENT ON COLUMN public.api_applications.icon_url
  IS 'URL pública del icono (bucket application-icons). NULL: se muestran las iniciales.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-icons',
  'application-icons',
  TRUE,
  524288,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Sin política SELECT a propósito: un bucket público ya sirve sus URLs
-- `/object/public/...` sin ella, y con ella la clave anónima podría LISTAR el
-- bucket y enumerar los ids de todas las aplicaciones. La escritura solo la
-- hace el servidor con la service role.
DROP POLICY IF EXISTS "application_icons_select_public" ON storage.objects;

COMMIT;
