import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { isAdminRole } from '@/lib/roles';
import { formatCurrency } from '@/lib/utils';
import { createSandboxBalance } from '@/lib/server/public-api-sandbox';
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

    if (!await requirePermission(auth, 'balance')) {
      apiKeyId = auth.apiKey!.id;
      await logPublicApiRequest({ context, apiKeyId, status: 403, errorCode: 'permission_denied' });
      return publicApiError(context, 'permission_denied', 'Permiso denegado: balance', 403, undefined, {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const { user_id, role_access } = auth.apiKey!;
    apiKeyId = auth.apiKey!.id;

    if (auth.apiKey!.environment === 'test') {
      await logPublicApiRequest({ context, apiKeyId, status: 200 });
      return publicApiSuccess(context, createSandboxBalance(role_access), {
        environment: auth.apiKey!.environment,
        rateLimit: auth.rateLimit,
      });
    }

    const adminClient = createAdminClient();

    let balanceData;

    if (isAdminRole(role_access)) {
      const { data: agents } = await adminClient
        .from('agent_balances')
        .select('*, user:users(name, phone)');
      
      const totalBalance = agents?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
      
      balanceData = {
        role: role_access,
        total_balance: totalBalance,
        currency: 'XAF',
        agents_count: agents?.length || 0,
        agents: agents?.map(a => ({
          id: a.agent_id,
          name: a.user?.name,
          phone: a.user?.phone,
          balance: a.balance,
          cash_balance: a.cash_balance || 0,
        })) || [],
      };
    } else if (role_access === 'gestor') {
      const { data: balance } = await adminClient
        .from('agent_balances')
        .select('*')
        .eq('agent_id', user_id)
        .single();

      balanceData = {
        role: 'gestor',
        balance: balance?.balance || 0,
        cash_balance: balance?.cash_balance || 0,
        currency: balance?.currency || 'XAF',
        formatted: formatCurrency(balance?.balance || 0),
      };
    } else {
      const { data: balance } = await adminClient
        .from('client_balances')
        .select('*')
        .eq('client_id', user_id)
        .single();

      balanceData = {
        role: 'cliente',
        balance: balance?.balance || 0,
        currency: balance?.currency || 'XAF',
        formatted: formatCurrency(balance?.balance || 0),
      };
    }

    await logPublicApiRequest({ context, apiKeyId, status: 200 });
    return publicApiSuccess(context, balanceData, {
      environment: auth.apiKey!.environment,
      rateLimit: auth.rateLimit,
    });

  } catch (error) {
    console.error('API Balance Error:', error);
    await logPublicApiRequest({ context, apiKeyId, status: 500, errorCode: 'internal_error' });
    return publicApiError(context, 'internal_error', 'Error interno del servidor', 500, undefined, {
      environment: apiEnvironment,
    });
  }
}
