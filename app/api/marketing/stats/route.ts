import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireSuperAdmin } from '@/lib/server/authz';

type MarketingLogRow = {
  action: string;
  metadata: unknown;
  created_at: string;
};

function readText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readMetadata(metadata: unknown) {
  return typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>) : {};
}

function increment(map: Map<string, number>, key: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map: Map<string, number>, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function GET() {
  try {
    const profile = await requireProfile();
    requireSuperAdmin(profile);

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('activity_logs')
      .select('action, metadata, created_at')
      .eq('entity_type', 'marketing_landing')
      .order('created_at', { ascending: false })
      .limit(1500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as MarketingLogRow[];
    const now = Date.now();
    const last7d = now - 7 * 24 * 60 * 60 * 1000;
    const last30d = now - 30 * 24 * 60 * 60 * 1000;

    const audienceTotals = new Map<string, number>();
    const ctaTotals = new Map<string, number>();
    const targetTotals = new Map<string, number>();
    const themeTotals = new Map<string, number>();
    const audienceSelectionTotals = new Map<string, number>();

    let totalEvents = 0;
    let events7d = 0;
    let events30d = 0;
    let totalCtaClicks = 0;
    let totalFormSubmits = 0;
    let totalAudienceSelections = 0;

    for (const row of rows) {
      totalEvents += 1;
      const createdAt = new Date(row.created_at).getTime();
      if (!Number.isNaN(createdAt)) {
        if (createdAt >= last7d) events7d += 1;
        if (createdAt >= last30d) events30d += 1;
      }

      const metadata = readMetadata(row.metadata);
      const audience = readText(metadata.audience);
      const cta = readText(metadata.cta);
      const target = readText(metadata.target);
      const theme = readText(metadata.theme);
      const selectedAudience = readText(metadata.selected_audience);

      increment(audienceTotals, audience);
      increment(ctaTotals, cta);
      increment(targetTotals, target);
      increment(themeTotals, theme);

      if (row.action === 'landing_cta_click') {
        totalCtaClicks += 1;
      }

      if (row.action === 'landing_form_submit') {
        totalFormSubmits += 1;
      }

      if (row.action === 'landing_audience_select') {
        totalAudienceSelections += 1;
        increment(audienceSelectionTotals, selectedAudience || audience);
      }
    }

    return NextResponse.json({
      totals: {
        total_events: totalEvents,
        events_7d: events7d,
        events_30d: events30d,
        cta_clicks: totalCtaClicks,
        form_submits: totalFormSubmits,
        audience_switches: totalAudienceSelections,
      },
      byAudience: topEntries(audienceTotals, 8),
      byCta: topEntries(ctaTotals, 8),
      byTarget: topEntries(targetTotals, 8),
      byTheme: topEntries(themeTotals, 4),
      audienceSelections: topEntries(audienceSelectionTotals, 8),
      recent: rows.slice(0, 12).map((row) => {
        const metadata = readMetadata(row.metadata);
        return {
          action: row.action,
          audience: readText(metadata.audience),
          cta: readText(metadata.cta),
          target: readText(metadata.target),
          theme: readText(metadata.theme),
          created_at: row.created_at,
        };
      }),
    });
  } catch (err) {
    console.error('[GET /api/marketing/stats]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
