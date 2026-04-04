import { ErrorScreen } from '@/components/layout/error-screen';

export default function UnauthorizedPage() {
  return (
    <ErrorScreen
      badge="401"
      title="No autorizado"
      description="Tu sesión no es válida o no tienes permisos para acceder a este recurso."
      actions={[
        { href: '/login', label: 'Iniciar sesión' },
        { href: '/', label: 'Ir al inicio', variant: 'outline' },
      ]}
    />
  );
}
