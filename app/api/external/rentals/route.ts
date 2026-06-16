import { NextRequest } from 'next/server';
import { z } from 'zod';
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

const rentalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'ended', 'cancelled']).optional(),
  property_id: z.string().trim().uuid().optional(),
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

    apiKeyId = auth.apiKey!.id;
    apiEnvironment = auth.apiKey!.environment;

    if (!await requirePermission(auth, 'properties')) {
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: properties', 403, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { user_id, role_access } = auth.apiKey!;
    const { searchParams } = new URL(request.url);
    const parsedQuery = rentalsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

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

    const { limit, offset, status, property_id } = parsedQuery.data;

    if (auth.apiKey!.environment === 'test') {
      await logPublicApiRequest({ context, apiKeyId, status: 200 });
      return publicApiSuccess(context, buildSandboxRentals(status), {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
        pagination: { limit, offset, has_more: false, next_offset: null },
      });
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from('rentals')
      .select('id, property_id, owner_id, tenant_id, tenant_name, tenant_phone, rent_amount, currency, billing_day, status, start_date, end_date, created_at')
      .order('created_at', { ascending: false });

    if (!isAdminRole(role_access)) {
      query = role_access === 'cliente'
        ? query.eq('tenant_id', user_id)
        : query.eq('owner_id', user_id);
    }

    if (status) query = query.eq('status', status);
    if (property_id) query = query.eq('property_id', property_id);

    const { data } = await query.range(offset, offset + limit);
    const rows = data || [];
    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

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

  } catch (error) {
    console.error('API Rentals Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}

function buildSandboxRentals(status?: 'active' | 'ended' | 'cancelled') {
  const sample = [
    {
      id: '00000000-0000-4000-8000-000000000301',
      property_id: '00000000-0000-4000-8000-000000000201',
      tenant_name: 'Inquilino Demo',
      tenant_phone: '+240222111000',
      rent_amount: 250000,
      currency: 'XAF',
      billing_day: 5,
      status: 'active' as const,
    },
  ];
  return status ? sample.filter((item) => item.status === status) : sample;
}
