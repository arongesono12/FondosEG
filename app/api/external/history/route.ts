import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/roles';
import {
  createPublicApiContext,
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';

export async function GET(request: NextRequest) {
  const context = createPublicApiContext(request);
  let apiKeyId: string | null = null;

  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      const status = auth.status || 401;
      const code = mapAuthErrorStatus(status);
      await logPublicApiRequest({ context, status, errorCode: code });
      return publicApiError(context, code, auth.error || 'Credenciales invalidas', status);
    }

    if (!await requirePermission(auth, 'history')) {
      apiKeyId = auth.apiKey!.id;
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: history', 403);
    }

    const { user_id, role_access } = auth.apiKey!;
    apiKeyId = auth.apiKey!.id;
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    const adminClient = createAdminClient();

    let transfers = [];

    if (isAdminRole(role_access)) {
      const { data } = await adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name, phone)')
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      transfers = data || [];
    } else if (role_access === 'gestor') {
      const { data } = await adminClient
        .from('transfers')
        .select('*')
        .eq('agent_id', user_id)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      transfers = data || [];
    } else {
      const { data } = await adminClient
        .from('wallet_transfers')
        .select('*')
        .or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      transfers = data || [];
    }

    await logPublicApiRequest({ context, apiKeyId, status: 200 });
    return publicApiSuccess(
      context,
      transfers,
      {
        pagination: {
        limit,
        offset,
        },
      }
    );

  } catch (error) {
    console.error('API History Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500);
  }
}
