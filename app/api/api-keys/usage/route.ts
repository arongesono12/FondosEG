import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireAuthUser } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUser();
    const adminClient = createAdminClient();
    const { searchParams } = new URL(request.url);
    const requestedApiKeyId = searchParams.get('api_key_id');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 100);

    const { data: apiKeys, error: apiKeysError } = await adminClient
      .from('api_keys')
      .select('id, app_name')
      .eq('user_id', user.id);

    if (apiKeysError) {
      return NextResponse.json({ error: apiKeysError.message }, { status: 500 });
    }

    const allowedKeyIds = (apiKeys || []).map((key) => key.id);
    const targetKeyIds = requestedApiKeyId ? [requestedApiKeyId] : allowedKeyIds;

    if (targetKeyIds.some((keyId) => !allowedKeyIds.includes(keyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (targetKeyIds.length === 0) {
      return NextResponse.json({ logs: [], summary: { total: 0, success: 0, errors: 0 } });
    }

    const { data: logs, error: logsError } = await adminClient
      .from('api_request_logs')
      .select('id, api_key_id, request_id, method, path, status_code, error_code, latency_ms, created_at')
      .in('api_key_id', targetKeyIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    const rows = logs || [];
    const success = rows.filter((log) => Number(log.status_code) < 400).length;
    const errors = rows.length - success;

    return NextResponse.json({
      logs: rows,
      summary: {
        total: rows.length,
        success,
        errors,
      },
    });
  } catch (error) {
    console.error('API key usage GET Error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
