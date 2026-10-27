import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, requireDeveloperAccess } from '@/lib/server/authz';
import {
  APPLICATION_SELECT,
  credentialRouteError,
  listVisibleApplications,
  type ApiApplicationRow,
} from '@/lib/server/credential-ownership';
import { isTrustedApplicationCreator } from '@/lib/server/credential-ownership-rules';
import { getAvailableClientBalance } from '@/lib/financial';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Aplicaciones de integradores. Cada una nace con su propia billetera: no hay
 * que elegir rol ni indicar el teléfono de ninguna cuenta.
 */

const createApplicationSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  description: z.string().trim().max(500).optional(),
}).strict();

async function withWalletSummary(applications: ApiApplicationRow[]) {
  if (applications.length === 0) return [];

  const { data: balances, error } = await createAdminClient()
    .from('client_balances')
    .select('client_id, balance, reserved_balance, currency')
    .in('client_id', applications.map((application) => application.wallet_user_id));

  if (error) throw new Error(error.message);

  const byWallet = new Map((balances || []).map((row) => [String(row.client_id), row]));

  return applications.map((application) => {
    const balance = byWallet.get(application.wallet_user_id);
    const gross = Number(balance?.balance ?? 0);
    const reserved = Number(balance?.reserved_balance ?? 0);
    return {
      id: application.id,
      name: application.name,
      description: application.description,
      icon_url: application.icon_url,
      is_trusted: application.is_trusted,
      has_dedicated_wallet: application.has_dedicated_wallet,
      status: application.status,
      created_at: application.created_at,
      wallet: {
        balance: gross,
        available_balance: getAvailableClientBalance(gross, reserved),
        currency: balance?.currency || 'XAF',
      },
    };
  });
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const applications = await listVisibleApplications(user.id, access.access_role);
    return NextResponse.json(await withWalletSummary(applications));
  } catch (error) {
    return credentialRouteError(error, 'Applications GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser();
    const access = await requireDeveloperAccess();
    const parsed = createApplicationSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Revisa los datos de la aplicación', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc('create_api_application', {
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? null,
      p_owner_user_id: user.id,
      p_is_trusted: isTrustedApplicationCreator(access.access_role),
    });

    if (error || !data) {
      console.error('create_api_application failed:', error);
      const missingMigration = /could not find the function/i.test(error?.message ?? '');
      return NextResponse.json(
        {
          error: missingMigration
            ? 'Falta aplicar la migración 20261026_api_applications.sql en la base de datos'
            : 'No se pudo crear la aplicación',
        },
        { status: missingMigration ? 503 : 500 }
      );
    }

    const { data: row, error: readError } = await adminClient
      .from('api_applications')
      .select(APPLICATION_SELECT)
      .eq('id', (data as { id: string }).id)
      .single();

    // Sin la migración de iconos la aplicación ya existe: el 503 de
    // `credentialRouteError` lo explica y aparecerá al aplicarla.
    if (readError || !row) throw new Error(readError?.message || 'No se pudo leer la aplicación');

    const [application] = await withWalletSummary([row as ApiApplicationRow]);
    return NextResponse.json({ success: true, application }, { status: 201 });
  } catch (error) {
    return credentialRouteError(error, 'Applications POST');
  }
}
