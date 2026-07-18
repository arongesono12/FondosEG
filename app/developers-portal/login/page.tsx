import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getOptionalAuthState } from '@/lib/server/authz';

export default async function DevelopersPortalLoginPage() {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    redirect('/login');
  }

  if (user) {
    redirect('/developer-console');
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <LoginForm
        title="Entrar al portal de APIs"
        description="Accede a tus credenciales, OpenAPI, SDK y webhooks de FondosEG."
        successRedirect="/developer-console"
        registerHref="/developers-portal/register"
        registerLabel="Crear cuenta de desarrollador"
      />
    </div>
  );
}
