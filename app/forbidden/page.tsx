import { ErrorScreen } from '@/components/layout/error-screen';

export default function ForbiddenPage() {
  return (
    <ErrorScreen
      badge="403"
      title="Operación indebida"
      description="No tienes permisos para ejecutar esta acción. Si necesitas acceso, contacta a administración."
      actions={[
        { href: '/dashboard', label: 'Volver al dashboard' },
        { href: '/login', label: 'Cambiar cuenta', variant: 'outline' },
      ]}
    />
  );
}
