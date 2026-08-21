import { Clock } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';

import { getRoleLabel } from '@/lib/roles';
import { Button } from '@/components/ui/button';

interface PendingApprovalScreenProps {
  role?: string | null;
}

/**
 * Cuenta creada y a la espera de aprobación manual. Se muestra en lugar del
 * dashboard, no como error: el usuario no ha hecho nada mal.
 */
export function PendingApprovalScreen({ role }: PendingApprovalScreenProps) {
  const roleLabel = getRoleLabel(role).toLowerCase();

  return (
    <div className="auth-public-page flex min-h-dvh items-center justify-center p-4">
      <div className="auth-card-premium w-full max-w-md">
        <div className="auth-card-inner flex flex-col items-center gap-4 p-8 text-center">
          <span className="pending-badge" aria-hidden="true">
            <Clock className="h-7 w-7" />
          </span>

          <h1 className="auth-title">Tu solicitud está en revisión</h1>

          <p className="auth-subtitle">
            Hemos recibido tu alta como <strong>{roleLabel}</strong>. Un administrador
            debe aprobarla antes de que puedas operar, porque este tipo de cuenta
            gestiona dinero de terceros.
          </p>

          <p className="auth-subtitle">
            Te avisaremos por correo en cuanto esté activa. Puedes cerrar esta ventana.
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
