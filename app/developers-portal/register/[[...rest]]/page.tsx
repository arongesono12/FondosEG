import { SignUp } from '@clerk/nextjs';

export default function DevelopersPortalRegisterPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta de desarrollador</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Registra tu acceso para generar API keys, usar el SDK y conectar tu proyecto con FondosEG.
        </p>
      </div>
      <SignUp
        path="/developers-portal/register"
        signInUrl="/developers-portal/login"
        fallbackRedirectUrl="/developer-console"
      />
    </div>
  );
}
