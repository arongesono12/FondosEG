import { ErrorScreen } from '@/components/layout/error-screen';

export default function NotFound() {
  return (
    <ErrorScreen
      badge="404"
      title="Página no encontrada"
      description="La ruta que intentas abrir no existe o fue movida. Verifica la URL o vuelve al panel principal."
      actions={[
        { href: '/dashboard', label: 'Ir al dashboard' },
        { href: '/login', label: 'Ir a login', variant: 'outline' },
      ]}
    />
  );
}
