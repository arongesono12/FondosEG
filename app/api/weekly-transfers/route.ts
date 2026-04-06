import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');
    const adminClient = createAdminClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6); // last 7 days (today + 6 prior)
    startDate.setHours(0, 0, 0, 0);

    const { data, error } = await adminClient
      .from('transfers')
      .select('created_at, amount')
      .in('status', ['completed', 'paid_out'])
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build per-day buckets for the last 7 days
    const result: Array<{ date: string; transfer_count: number; total_amount: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push({
        date: d.toISOString().split('T')[0],
        transfer_count: 0,
        total_amount: 0,
      });
    }

    interface Transfer { created_at: string; amount: number }
    (data as Transfer[] || []).forEach((t) => {
      const day = new Date(t.created_at).toISOString().split('T')[0];
      const bucket = result.find((r) => r.date === day);
      if (bucket) {
        bucket.transfer_count += 1;
        bucket.total_amount += Number(t.amount);
      }
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/weekly-transfers]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
