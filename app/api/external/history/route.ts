import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/roles';
import { createSandboxHistory } from '@/lib/server/public-api-sandbox';
import {
  createPublicApiContext,
  logPublicApiRequest,
  mapAuthErrorStatus,
  publicApiError,
  publicApiSuccess,
} from '@/lib/server/public-api';

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().trim().min(1).max(40).optional(),
  created_from: z.string().trim().datetime({ offset: true }).optional(),
  created_to: z.string().trim().datetime({ offset: true }).optional(),
}).strict();

export async function GET(request: NextRequest) {
  const context = createPublicApiContext(request);
  let apiKeyId: string | null = null;
  let apiEnvironment: 'test' | 'production' | undefined;

  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      const status = auth.status || 401;
      const code = auth.errorCode || mapAuthErrorStatus(status);
      await logPublicApiRequest({ context, status, errorCode: code });
      return publicApiError(context, code, auth.error || 'Credenciales invalidas', status, undefined, {
        rateLimit: auth.rateLimit,
      });
    }

    apiEnvironment = auth.apiKey!.environment;

    if (!await requirePermission(auth, 'history')) {
      apiKeyId = auth.apiKey!.id;
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: history', 403, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { user_id, role_access } = auth.apiKey!;
    apiKeyId = auth.apiKey!.id;
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const parsedQuery = historyQuerySchema.safeParse(queryParams);

    if (!parsedQuery.success) {
      await logPublicApiRequest({ context, apiKeyId, status: 400, errorCode: 'validation_error' });
      return publicApiError(
        context,
        'validation_error',
        'Parametros de consulta invalidos',
        400,
        parsedQuery.error.flatten().fieldErrors,
        { environment: auth.apiKey!.environment, rateLimit: auth.rateLimit }
      );
    }

    const { limit, offset, status, created_from, created_to } = parsedQuery.data;
    const rangeEnd = offset + limit;

    if (auth.apiKey!.environment === 'test') {
      const sandboxItems = createSandboxHistory(role_access).filter((item) => {
        if (status && item.status !== status) return false;
        if (created_from && item.created_at < created_from) return false;
        if (created_to && item.created_at > created_to) return false;
        return true;
      });
      const pageItems = sandboxItems.slice(offset, offset + limit);
      const hasMore = sandboxItems.length > offset + limit;

      await logPublicApiRequest({ context, apiKeyId, status: 200 });
      return publicApiSuccess(context, pageItems, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
        pagination: {
          limit,
          offset,
          has_more: hasMore,
          next_offset: hasMore ? offset + limit : null,
        },
      });
    }

    const adminClient = createAdminClient();

    let transfers = [];

    if (isAdminRole(role_access)) {
      let query = adminClient
        .from('transfers')
        .select('*, agent:users!transfers_agent_id_fkey(name, phone)')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (created_from) query = query.gte('created_at', created_from);
      if (created_to) query = query.lte('created_at', created_to);

      const { data } = await query.range(offset, rangeEnd);
      
      transfers = data || [];
    } else if (role_access === 'gestor') {
      let query = adminClient
        .from('transfers')
        .select('*')
        .eq('agent_id', user_id)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (created_from) query = query.gte('created_at', created_from);
      if (created_to) query = query.lte('created_at', created_to);

      const { data } = await query.range(offset, rangeEnd);
      
      transfers = data || [];
    } else {
      let query = adminClient
        .from('wallet_transfers')
        .select('*')
        .or(`sender_id.eq.${user_id},receiver_id.eq.${user_id}`)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (created_from) query = query.gte('created_at', created_from);
      if (created_to) query = query.lte('created_at', created_to);

      const { data } = await query.range(offset, rangeEnd);
      
      transfers = data || [];
    }

    const hasMore = transfers.length > limit;
    const pageItems = hasMore ? transfers.slice(0, limit) : transfers;

    await logPublicApiRequest({ context, apiKeyId, status: 200 });
    return publicApiSuccess(
      context,
      pageItems,
      {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
        pagination: {
          limit,
          offset,
          has_more: hasMore,
          next_offset: hasMore ? offset + limit : null,
        },
      }
    );

  } catch (error) {
    console.error('API History Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}
