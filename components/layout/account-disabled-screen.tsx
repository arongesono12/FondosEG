import { LockKeyhole } from '@/components/ui/hugeicons';
import { SignOutButton } from '@clerk/nextjs';

import { Button } from '@/components/ui/button';

/**
 * Cuenta desactivada por administración. Sustituye al dashboard completo: sin
 * shell no hay widgets ni sondeos golpeando una API que respondería 403.
 */
export function AccountDisabledScreen() {
  return (
    <div className="auth-public-page flex min-h-dvh items-center justify-center p-4">
      <div className="auth-card-premium w-full max-w-md">
        <div className="auth-card-inner flex flex-col items-center gap-4 p-8 text-center">
          <span className="pending-badge" aria-hidden="true">
            <LockKeyhole className="h-7 w-7" />
          </span>

          <h1 className="auth-title">Tu cuenta está desactivada</h1>

          <p className="auth-subtitle">
            Un administrador ha suspendido el acceso de esta cuenta, así que por
            ahora no puedes consultar saldos ni operar.
          </p>

          <p className="auth-subtitle">
            Si crees que es un error, contacta con administración para que la
            reactive.
          </p>

          <SignOutButton redirectUrl="/login">
            <Button variant="outline" className="mt-2 w-full">
              Cerrar sesión
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
