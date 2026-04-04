import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, requireRole } from '@/lib/server/authz';
import { handleRouteError } from '@/lib/server/route-error';

type Kind = 'agent' | 'client' | 'admin';

function defaultKind(role: string): Kind {
  if (role === 'admin') return 'admin';
  if (role === 'cliente') return 'client';
  return 'agent';
}

type CacheEntry = { count: number; expiresAt: number };
const COUNT_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15000;

function getCacheKey(kind: Kind, profileId: string) {
  return `${kind}:${profileId}`;
}

function readCache(key: string): number | null {
  const entry = COUNT_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    COUNT_CACHE.delete(key);
    return null;
  }
  return entry.count;
}

function writeCache(key: string, count: number) {
  COUNT_CACHE.set(key, { count, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfile();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const kind = ((searchParams.get('kind') || defaultKind(profile.role)) as Kind) || defaultKind(profile.role);
    const cacheKey = getCacheKey(kind, profile.id);
    const cached = readCache(cacheKey);
    if (cached !== null) {
      return NextResponse.json({ count: cached });
    }

    if (kind === 'admin') {
      requireRole(profile, 'admin');
      const { count, error } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin_notification', true)
        .eq('is_read', false);
      if (error) throw error;
      const total = count || 0;
      writeCache(cacheKey, total);
      return NextResponse.json({ count: total });
    }

    if (kind === 'client') {
      const { count, error } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);
      if (error) throw error;
      const total = count || 0;
      writeCache(cacheKey, total);
      return NextResponse.json({ count: total });
    }

    // agent: filter by transfer relation to avoid large IN payloads
    const { count, error } = await adminClient
      .from('notifications')
      .select('id, transfer:transfers!notifications_transfer_id_fkey(id, agent_id)', { count: 'exact', head: true })
      .eq('transfer.agent_id', profile.id)
      .eq('is_read', false);

    if (error) throw error;
    const total = count || 0;
    writeCache(cacheKey, total);
    return NextResponse.json({ count: total });
  } catch (err) {
    return handleRouteError(err, 'GET /api/me/notifications/unread-count');
  }
}
