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

const propertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['available', 'rented', 'inactive']).optional(),
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
    const parsedQuery = propertiesQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));

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

    const { limit, offset, status } = parsedQuery.data;

    if (auth.apiKey!.environment === 'test') {
      await logPublicApiRequest({ context, apiKeyId, status: 200 });
      return publicApiSuccess(context, buildSandboxProperties(status), {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
        pagination: { limit, offset, has_more: false, next_offset: null },
      });
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from('properties')
      .select('id, owner_id, code, title, description, address, city, country, monthly_rent, currency, status, created_at')
      .order('created_at', { ascending: false });

    if (!isAdminRole(role_access)) {
      // Owners see their own listings; tenants see properties they rent.
      if (role_access === 'cliente') {
        const { data: rentalRows } = await adminClient
          .from('rentals')
          .select('property_id')
          .eq('tenant_id', user_id);
        const propertyIds = (rentalRows || []).map((row) => row.property_id);
        if (propertyIds.length === 0) {
          await logPublicApiRequest({ context, apiKeyId, status: 200 });
          return publicApiSuccess(context, [], {
            environment: auth.apiKey!.environment,
            rateLimit: auth.rateLimit,
            pagination: { limit, offset, has_more: false, next_offset: null },
          });
        }
        query = query.in('id', propertyIds);
      } else {
        query = query.eq('owner_id', user_id);
      }
    }

    if (status) query = query.eq('status', status);

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
    console.error('API Properties Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}

function buildSandboxProperties(status?: 'available' | 'rented' | 'inactive') {
  const sample = [
    {
      id: '00000000-0000-4000-8000-000000000201',
      code: 'PROP-SBX-001',
      title: 'Apartamento Centro (sandbox)',
      city: 'Malabo',
      country: 'GQ',
      monthly_rent: 250000,
      currency: 'XAF',
      status: 'rented' as const,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      code: 'PROP-SBX-002',
      title: 'Estudio Ela Nguema (sandbox)',
      city: 'Malabo',
      country: 'GQ',
      monthly_rent: 120000,
      currency: 'XAF',
      status: 'available' as const,
    },
  ];
  return status ? sample.filter((item) => item.status === status) : sample;
}
