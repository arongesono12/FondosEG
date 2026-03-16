import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';

interface UserPresence {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  is_active: boolean;
  isOnline: boolean;
  lastSeen?: string;
  device?: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
}

function parseUA(ua: string): { device: UserPresence['device']; browser: string; os: string } {
  const isMobile = /Mobile|Android|iPhone/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device: UserPresence['device'] = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'Desconocido';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/OPR\//i.test(ua)) browser = 'Opera';

  let os = 'Desconocido';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { device, browser, os };
}

export async function GET() {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');
    const adminClient = createAdminClient();

    // Get all users
    const { data: usersData, error: usersError } = await adminClient
      .from('users')
      .select('id, name, email, role, avatar_url, is_active')
      .order('name', { ascending: true });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // Get the most recent activity log per user (last 24h = online heuristic)
    const onlineThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 min
    const recentThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logsData } = await adminClient
      .from('activity_logs')
      .select('user_id, created_at, user_agent, ip_address')
      .gte('created_at', recentThreshold)
      .order('created_at', { ascending: false });

    // Build a map of most recent log per user
    const latestLogByUser = new Map<string, { created_at: string; user_agent?: string; ip_address?: string }>();
    (logsData || []).forEach((log: any) => {
      if (!latestLogByUser.has(log.user_id)) {
        latestLogByUser.set(log.user_id, {
          created_at: log.created_at,
          user_agent: log.user_agent,
          ip_address: log.ip_address,
        });
      }
    });

    const result: UserPresence[] = (usersData || []).map((u: any) => {
      const log = latestLogByUser.get(u.id);
      const isOnline = log ? new Date(log.created_at) >= new Date(onlineThreshold) : false;
      const ua = log?.user_agent || '';
      const parsed = ua ? parseUA(ua) : { device: 'unknown' as const, browser: '', os: '' };

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar_url: u.avatar_url,
        is_active: u.is_active,
        isOnline,
        lastSeen: log?.created_at,
        device: parsed.device,
        browser: parsed.browser || undefined,
        os: parsed.os || undefined,
        ipAddress: log?.ip_address || undefined,
      };
    });

    // Sort: online first, then by name
    result.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/users-presence]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
