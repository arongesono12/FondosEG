BEGIN;

CREATE TABLE IF NOT EXISTS public.account_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product TEXT NOT NULL CHECK (product IN ('dashboard', 'developer_portal')),
  access_role TEXT NOT NULL CHECK (access_role IN ('cliente', 'gestor', 'developer', 'admin', 'superadmin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product)
);

CREATE TABLE IF NOT EXISTS public.developer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  country TEXT,
  city TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_access_product_status
  ON public.account_access(product, status);

-- Existing financial users retain Dashboard access. Only application
-- administrators receive access to both products automatically.
INSERT INTO public.account_access (user_id, product, access_role, status)
SELECT id, 'dashboard', role, CASE WHEN is_active THEN 'active' ELSE 'suspended' END
FROM public.users
ON CONFLICT (user_id, product) DO UPDATE
SET access_role = EXCLUDED.access_role,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO public.account_access (user_id, product, access_role, status)
SELECT id, 'developer_portal', role, CASE WHEN is_active THEN 'active' ELSE 'suspended' END
FROM public.users
WHERE role IN ('admin', 'superadmin')
ON CONFLICT (user_id, product) DO UPDATE
SET access_role = EXCLUDED.access_role,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Developer-only identities do not need a row in public.users. API resources
-- therefore belong directly to the authenticated identity.
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_subscriptions DROP CONSTRAINT IF EXISTS webhook_subscriptions_user_id_fkey;
ALTER TABLE public.webhook_subscriptions
  ADD CONSTRAINT webhook_subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.account_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own product access" ON public.account_access;
CREATE POLICY "Users can read own product access"
  ON public.account_access FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own developer profile" ON public.developer_profiles;
CREATE POLICY "Users can read own developer profile"
  ON public.developer_profiles FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own developer profile" ON public.developer_profiles;
CREATE POLICY "Users can update own developer profile"
  ON public.developer_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.account_access FROM anon;
REVOKE ALL ON public.developer_profiles FROM anon;
GRANT SELECT ON public.account_access TO authenticated;
GRANT SELECT, UPDATE ON public.developer_profiles TO authenticated;

COMMIT;
