import { NextResponse } from 'next/server';

import { getAuthErrorMessage, isAuthServiceUnavailableError } from '@/lib/supabase/auth-errors';
import { AuthzError } from '@/lib/server/authz';

type ErrorPayload =
  | { error: string }
  | { success: false; error: string };

export function handleRouteError(
  err: unknown,
  scope: string,
  options?: { mutation?: boolean }
) {
  console.error(`[${scope}]`, err);

  if (err instanceof AuthzError) {
    return NextResponse.json(createPayload(err.message, options), { status: err.status });
  }

  if (isAuthServiceUnavailableError(err)) {
    return NextResponse.json(
      createPayload(getAuthErrorMessage(err), options),
      { status: 503 }
    );
  }

  return NextResponse.json(createPayload('Internal server error', options), { status: 500 });
}

function createPayload(message: string, options?: { mutation?: boolean }): ErrorPayload {
  if (options?.mutation) {
    return { success: false, error: message };
  }

  return { error: message };
}
