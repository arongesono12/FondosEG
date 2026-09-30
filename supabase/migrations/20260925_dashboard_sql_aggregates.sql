-- ============================================================================
-- Estadísticas del dashboard calculadas en PostgreSQL
-- ============================================================================
--
-- POR QUÉ
--
-- Las rutas /api/dashboard/stats, /daily-transfer-stats y /agent-transfer-stats
-- descargaban todas las filas de `transfers` (y `wallet_transfers` para
-- clientes) y sumaban/contaban en Node. Además del coste en red y memoria,
-- PostgREST limita cada respuesta al `max_rows` configurado (1.000 por
-- defecto): a partir de ese volumen los totales salían truncados sin error.
--
-- Estas funciones devuelven sólo los agregados. Las reglas de estado replican
-- `lib/financial.ts`:
--   · completada  = 'completed' | 'paid_out'           (billetera: 'confirmed')
--   · cancelada   = 'cancelled' | 'expired'
--   · pendiente   = cualquier otro valor, incluido NULL ('created' por defecto)
--   · comisión    = commission_amount si > 0; si no, la tarifa vigente
--                   (`calculate_tariff_commission`, igual que `calculateCommission`).
--
-- Los límites de periodo (hoy, 7 días, 30 días, mes, año) los pasa la ruta
-- para que el significado de «hoy» siga definido en un único sitio.
--
-- Sólo `service_role` puede ejecutarlas: las rutas ya resuelven la
-- autorización y pasan el alcance (agente, cliente o NULL = todo) explícito.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Gestor (p_agent_id) o administrador (p_agent_id NULL)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_operator_stats(
  p_agent_id UUID,
  p_today TIMESTAMPTZ,
  p_week_start TIMESTAMPTZ,
  p_thirty_days_start TIMESTAMPTZ,
  p_month_start TIMESTAMPTZ,
  p_year_start TIMESTAMPTZ,
  p_low_balance_threshold NUMERIC DEFAULT 25000
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT
      t.amount,
      t.created_at,
      COALESCE(t.status, 'created') AS status,
      CASE
        WHEN t.status IN ('completed', 'paid_out') THEN 'completed'
        WHEN t.status IN ('cancelled', 'expired') THEN 'cancelled'
        ELSE 'pending'
      END AS lifecycle,
      t.commission_amount
    FROM public.transfers t
    WHERE p_agent_id IS NULL OR t.agent_id = p_agent_id
  ),
  priced AS (
    SELECT
      s.*,
      CASE
        WHEN s.lifecycle = 'cancelled' THEN 0
        WHEN COALESCE(s.commission_amount, 0) > 0 THEN s.commission_amount
        ELSE public.calculate_tariff_commission(COALESCE(s.amount, 0))
      END AS commission
    FROM scoped s
  ),
  transfer_totals AS (
    SELECT jsonb_build_object(
      'completed_count',          COUNT(*) FILTER (WHERE lifecycle = 'completed'),
      'completed_amount',         COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed'), 0),
      'pending_count',            COUNT(*) FILTER (WHERE lifecycle = 'pending'),
      'pending_amount',           COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'pending'), 0),
      'cancelled_count',          COUNT(*) FILTER (WHERE lifecycle = 'cancelled'),
      'pickup_ready_count',       COUNT(*) FILTER (WHERE status = 'available_for_pickup'),
      'pickup_ready_amount',      COALESCE(SUM(amount) FILTER (WHERE status = 'available_for_pickup'), 0),
      'today_count',              COUNT(*) FILTER (WHERE created_at >= p_today),
      'today_completed_amount',   COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed' AND created_at >= p_today), 0),
      'week_completed_amount',    COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed' AND created_at >= p_week_start), 0),
      'thirty_days_completed_amount', COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed' AND created_at >= p_thirty_days_start), 0),
      'commissionable_count',     COUNT(*) FILTER (WHERE lifecycle <> 'cancelled'),
      'commission_total',         COALESCE(SUM(commission), 0),
      'commission_today',         COALESCE(SUM(commission) FILTER (WHERE created_at >= p_today), 0),
      'commission_month',         COALESCE(SUM(commission) FILTER (WHERE created_at >= p_month_start), 0),
      'commission_year',          COALESCE(SUM(commission) FILTER (WHERE created_at >= p_year_start), 0)
    ) AS totals
    FROM priced
  ),
  balances AS (
    SELECT
      COALESCE(
        (SELECT jsonb_object_agg(currency, total)
           FROM (
             SELECT COALESCE(b.currency, 'XAF') AS currency, SUM(COALESCE(b.balance, 0)) AS total
             FROM public.agent_balances b
             WHERE p_agent_id IS NULL OR b.agent_id = p_agent_id
             GROUP BY 1
           ) by_currency),
        '{}'::jsonb
      ) AS by_currency,
      (SELECT COUNT(*)
         FROM public.agent_balances b
        WHERE (p_agent_id IS NULL OR b.agent_id = p_agent_id)
          AND COALESCE(b.balance, 0) < p_low_balance_threshold) AS below_threshold
  )
  SELECT t.totals || jsonb_build_object(
    'balances_by_currency', b.by_currency,
    'agents_below_threshold', b.below_threshold,
    'total_clients', CASE
      WHEN p_agent_id IS NULL THEN (SELECT COUNT(*) FROM public.users WHERE role = 'cliente')
      ELSE (SELECT COUNT(DISTINCT sender_phone) FROM public.transfers WHERE agent_id = p_agent_id)
    END,
    'active_agents', CASE
      WHEN p_agent_id IS NULL THEN (SELECT COUNT(*) FROM public.users WHERE role = 'gestor' AND is_active = TRUE)
      ELSE NULL
    END
  )
  FROM transfer_totals t CROSS JOIN balances b;
$$;

-- ---------------------------------------------------------------------------
-- Cliente: movimientos de billetera (enviados y recibidos) + envíos de gestor
-- recibidos en su billetera.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_client_stats(
  p_client_id UUID,
  p_today TIMESTAMPTZ,
  p_week_start TIMESTAMPTZ,
  p_thirty_days_start TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH movements AS (
    SELECT
      w.amount,
      w.created_at,
      CASE
        WHEN w.status = 'confirmed' THEN 'completed'
        WHEN w.status IN ('cancelled', 'expired') THEN 'cancelled'
        ELSE 'pending'
      END AS lifecycle
    FROM public.wallet_transfers w
    WHERE w.sender_id = p_client_id OR w.receiver_id = p_client_id
    UNION ALL
    SELECT
      t.amount,
      t.created_at,
      CASE
        WHEN t.status IN ('completed', 'paid_out') THEN 'completed'
        WHEN t.status IN ('cancelled', 'expired') THEN 'cancelled'
        ELSE 'pending'
      END
    FROM public.transfers t
    WHERE t.receiver_user_id = p_client_id
  )
  SELECT jsonb_build_object(
    'completed_count',          COUNT(*) FILTER (WHERE lifecycle = 'completed'),
    'completed_amount',         COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed'), 0),
    'pending_count',            COUNT(*) FILTER (WHERE lifecycle = 'pending'),
    'cancelled_count',          COUNT(*) FILTER (WHERE lifecycle = 'cancelled'),
    'today_count',              COUNT(*) FILTER (WHERE created_at >= p_today),
    'today_completed_amount',   COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed' AND created_at >= p_today), 0),
    'week_completed_amount',    COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed' AND created_at >= p_week_start), 0),
    'thirty_days_completed_amount', COALESCE(SUM(amount) FILTER (WHERE lifecycle = 'completed' AND created_at >= p_thirty_days_start), 0)
  )
  FROM movements;
$$;

-- ---------------------------------------------------------------------------
-- Serie diaria de envíos completados (días naturales en UTC, sin huecos).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_daily_transfer_stats(
  p_agent_id UUID,
  p_days INTEGER
)
RETURNS TABLE (
  date TEXT,
  transfer_count BIGINT,
  total_amount NUMERIC,
  agent_count BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (NOW() AT TIME ZONE 'UTC')::date AS last_day,
      (NOW() AT TIME ZONE 'UTC')::date - (LEAST(GREATEST(p_days, 1), 365) - 1) AS first_day
  ),
  per_day AS (
    SELECT
      (t.created_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*) AS transfer_count,
      COALESCE(SUM(t.amount), 0) AS total_amount,
      COUNT(DISTINCT t.agent_id) AS agent_count
    FROM public.transfers t, bounds
    WHERE t.created_at >= (bounds.first_day::timestamp AT TIME ZONE 'UTC')
      AND t.status IN ('completed', 'paid_out')
      AND (p_agent_id IS NULL OR t.agent_id = p_agent_id)
    GROUP BY 1
  )
  SELECT
    to_char(g.ts::date, 'YYYY-MM-DD'),
    COALESCE(p.transfer_count, 0),
    COALESCE(p.total_amount, 0),
    COALESCE(p.agent_count, 0)
  FROM bounds
  CROSS JOIN LATERAL generate_series(bounds.first_day, bounds.last_day, INTERVAL '1 day') AS g(ts)
  LEFT JOIN per_day p ON p.day = g.ts::date
  ORDER BY g.ts;
$$;

-- ---------------------------------------------------------------------------
-- Ranking de gestores por volumen completado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_agent_transfer_stats(p_limit INTEGER DEFAULT NULL)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  transfer_count BIGINT,
  total_sent NUMERIC,
  last_transfer TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    t.agent_id,
    COALESCE(MAX(u.name), 'Unknown')::TEXT,
    COUNT(*),
    COALESCE(SUM(t.amount), 0),
    MAX(t.created_at)
  FROM public.transfers t
  LEFT JOIN public.users u ON u.id = t.agent_id
  WHERE t.status IN ('completed', 'paid_out')
    AND t.agent_id IS NOT NULL
  GROUP BY t.agent_id
  ORDER BY 4 DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.dashboard_operator_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_client_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_daily_transfer_stats(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_agent_transfer_stats(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_operator_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_client_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_daily_transfer_stats(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_agent_transfer_stats(INTEGER) TO service_role;

COMMIT;
