import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState } from '@/lib/server/authz';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
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

  return (
    <div
      className="auth-public-page relative flex min-h-dvh flex-col overflow-y-auto overscroll-y-contain p-4 transition-colors duration-500"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/*
        Cabecera en flujo normal, no posicionada en absoluto. Antes el selector
        de tema era el único elemento superior y flotaba con `absolute`; al
        añadir la marca a su izquierda, mantenerlos flotando obligaba a
        reservar a mano el hueco de la cabecera para que la tarjeta no pasara
        por debajo en móvil, donde arranca pegada arriba. Con la cabecera en
        flujo, ese hueco lo calcula el propio layout.
      */}
      <header className="flex w-full shrink-0 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="FondosEG — ir al inicio"
          className="inline-flex min-h-11 items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <DashboardLogo size="sm" priority />
        </Link>

        <ThemeToggle />
      </header>

      {/*
        `justify-start` en móvil es deliberado: con `justify-center`, un
        formulario más alto que la pantalla desborda por ARRIBA y esa parte
        queda inalcanzable. El scroll propio permite además que el navegador
        desplace el campo enfocado al abrirse el teclado virtual.
      */}
      <div className="flex w-full flex-1 flex-col items-center justify-start sm:justify-center">
        {/* Móvil: ancho completo. Escritorio: tarjeta de ancho acotado. */}
        <div className="w-full md:max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </div>
    </div>
  );
}
