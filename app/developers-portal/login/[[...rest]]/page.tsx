import { SignIn } from '@clerk/nextjs';

export default function DevelopersPortalLoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar al portal de APIs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accede a tus credenciales, OpenAPI, SDK y webhooks de FondosEG.
        </p>
      </div>
      <SignIn
        path="/developers-portal/login"
        signUpUrl="/developers-portal/register"
        fallbackRedirectUrl="/developer-console"
      />
    </div>
  );
}
