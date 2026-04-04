import { ErrorScreen } from '@/components/layout/error-screen';

export default function DashboardNotFound() {
  return (
    <ErrorScreen
      badge="404"
      title="Página no encontrada"
      description="La ruta del dashboard no existe o fue movida. Revisa el enlace o vuelve al panel principal."
      actions={[
        { href: '/dashboard', label: 'Ir al dashboard' },
        { href: '/login', label: 'Ir a login', variant: 'outline' },
      ]}
    />
  );
}
