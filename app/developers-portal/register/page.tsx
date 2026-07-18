import { redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/register-form';
import { getOptionalAuthState } from '@/lib/server/authz';

interface DevelopersPortalRegisterPageProps {
  searchParams: Promise<{
    name?: string | string[];
    email?: string | string[];
    phone?: string | string[];
  }>;
}

function readParam(value?: string | string[]) {
  return typeof value === 'string' ? value : undefined;
}

export default async function DevelopersPortalRegisterPage({ searchParams }: DevelopersPortalRegisterPageProps) {
  const { user, serviceUnavailable } = await getOptionalAuthState();
  const params = await searchParams;

  if (serviceUnavailable) {
    redirect('/register');
  }

  if (user) {
    redirect('/developer-console');
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <RegisterForm
        title="Crear cuenta de desarrollador"
        description="Registra tu acceso para generar API keys, usar el SDK y conectar tu otro proyecto con FondosEG."
        successRedirect="/developer-console"
        successTitle="Tu portal de APIs esta listo"
        successDescription="Ya puedes entrar a la consola de desarrolladores de FondosEG."
        loginHref="/developers-portal/login"
        loginLabel="Entrar al portal"
        submitLabel="Crear cuenta de desarrollador"
        defaultRole="cliente"
        signupEndpoint="/api/auth/developer-signup"
        showRoleSelector={false}
        prefill={{
          name: readParam(params.name),
          email: readParam(params.email),
          phone: readParam(params.phone),
          role: 'cliente',
        }}
      />
    </div>
  );
}
