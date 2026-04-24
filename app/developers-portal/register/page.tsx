import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/register-form';
import { getOptionalAuthState } from '@/lib/server/authz';

export default async function DevelopersPortalRegisterPage() {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    redirect('/register');
  }

  if (user) {
    redirect('/developers');
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <RegisterForm
        title="Crear cuenta de desarrollador"
        description="Registra tu acceso para generar API keys, usar el SDK y conectar tu otro proyecto con FondosEG."
        successRedirect="/developers"
        successTitle="¡Tu portal de APIs está listo!"
        successDescription="Ya puedes entrar a la consola de desarrolladores de FondosEG."
        loginHref="/developers-portal/login"
        loginLabel="Entrar al portal"
        submitLabel="Crear cuenta de desarrollador"
      />
    </div>
  );
}
