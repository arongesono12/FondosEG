import { redirect } from 'next/navigation';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState } from '@/lib/server/authz';
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, serviceUnavailable, needsOnboarding } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/login" />;
  }

  // Ya autenticado en Clerk pero sin perfil interno. Sin este caso el usuario
  // volvería a ver el formulario de acceso justo después de entrar con Google,
  // como si el login no hubiera funcionado.
  if (needsOnboarding) {
    redirect('/onboarding');
  }

  if (user) {
    redirect('/dashboard');
  }

  // `justify-start` en móvil es deliberado: con `justify-center`, un formulario
  // más alto que la pantalla desborda por ARRIBA y esa parte es inalcanzable.
  // El scroll propio permite además que el navegador desplace el campo enfocado
  // cuando se abre el teclado virtual.
  return (
    <div
      className="auth-public-page relative flex min-h-dvh flex-col items-center justify-start overflow-y-auto overscroll-y-contain p-4 transition-colors duration-500 sm:justify-center"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* Theme Toggle - Top Right on Desktop and Mobile */}
      <div
        className="absolute z-50"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <ThemeToggle />
      </div>

      {/* Mobile: Full width, Desktop: Max width card */}
      <div className="w-full md:max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}
