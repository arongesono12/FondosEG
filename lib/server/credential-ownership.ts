import 'server-only';
import { NextResponse } from 'next/server';
import { AuthzError } from '@/lib/server/authz';
import {
  buildOwnedOrIssuedFilter,
  canManageEveryApplication,
  isUuid,
} from '@/lib/server/credential-ownership-rules';
import { isTransientNetworkError } from '@/lib/network-errors';
import { createAdminClient } from '@/lib/supabase/admin';

export class CredentialOwnerError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CredentialOwnerError';
    this.status = status;
  }
}

/** Respuesta común de las rutas del portal (aplicaciones, credenciales, webhooks). */
export function credentialRouteError(error: unknown, label: string): NextResponse {
  if (error instanceof CredentialOwnerError || error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`${label} Error:`, error);
  // `APPLICATION_SELECT` pide `icon_url`: sin la migración fallaría todo el
  // portal con un 500 genérico. Mejor decir qué falta.
  if (error instanceof Error && /icon_url.*does not exist/i.test(error.message)) {
    return NextResponse.json(
      { error: 'Falta aplicar la migración 20261027_api_application_icons.sql en la base de datos' },
      { status: 503 }
    );
  }
  if (isTransientNetworkError(error)) {
    return NextResponse.json(
      { error: 'No se pudo conectar con la base de datos. Intenta de nuevo en unos segundos.' },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

export const APPLICATION_SELECT =
  'id, name, description, icon_url, owner_user_id, wallet_user_id, has_dedicated_wallet, is_trusted, status, created_at, updated_at';

export interface ApiApplicationRow {
  id: string;
  name: string;
  description: string | null;
  /** URL pública en el bucket `application-icons`; NULL muestra las iniciales. */
  icon_url: string | null;
  owner_user_id: string;
  /** Billetera que operan sus credenciales y a la que se abonan sus cobros. */
  wallet_user_id: string;
  has_dedicated_wallet: boolean;
  is_trusted: boolean;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

/** Aplicaciones activas que el actor gestiona (todas, para el superadmin). */
export async function listVisibleApplications(actorUserId: string, actorAccessRole: string): Promise<ApiApplicationRow[]> {
  let query = createAdminClient()
    .from('api_applications')
    .select(APPLICATION_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (!canManageEveryApplication(actorAccessRole)) {
    query = query.eq('owner_user_id', actorUserId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ApiApplicationRow[];
}

/** Aplicación activa que el actor puede gestionar; 404 si no existe para él. */
export async function requireVisibleApplication(
  applicationId: unknown,
  actorUserId: string,
  actorAccessRole: string
): Promise<ApiApplicationRow> {
  if (!isUuid(applicationId)) {
    throw new CredentialOwnerError('Selecciona una aplicación válida', 400);
  }

  let query = createAdminClient()
    .from('api_applications')
    .select(APPLICATION_SELECT)
    .eq('id', applicationId)
    .eq('status', 'active');

  if (!canManageEveryApplication(actorAccessRole)) {
    query = query.eq('owner_user_id', actorUserId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new CredentialOwnerError('Aplicación no encontrada', 404);
  return data as ApiApplicationRow;
}

/**
 * Filtro `.or()` de las credenciales y webhooks que el actor gestiona: los de
 * sus aplicaciones y los anteriores a ellas (ver `buildOwnedOrIssuedFilter`).
 */
export async function buildCredentialScopeFilter(actorUserId: string, actorAccessRole: string): Promise<string> {
  const applications = await listVisibleApplications(actorUserId, actorAccessRole);
  return buildOwnedOrIssuedFilter(
    actorUserId,
    actorAccessRole,
    applications.map((application) => application.wallet_user_id)
  );
}
