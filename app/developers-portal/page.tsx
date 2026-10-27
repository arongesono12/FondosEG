import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, KeyRound, Webhook, BookOpen, Package } from '@/components/ui/hugeicons';
import { Button } from '@/components/ui/button';
import { getOptionalAuthState } from '@/lib/server/authz';

// Redirige según haya sesión o no, así que se resuelve por petición.
export const dynamic = 'force-dynamic';

const PORTAL_STEPS = [
  { icon: KeyRound, title: 'Crea tu cuenta', detail: 'Regístrate como desarrollador y entra a tu consola.' },
  { icon: Package, title: 'Da de alta tu aplicación', detail: 'Cada aplicación tiene su propia billetera FondosEG: sin rol ni teléfono.' },
  { icon: BookOpen, title: 'Integra la API', detail: 'Cobra a clientes y envía dinero a sus billeteras con ejemplos listos para copiar.' },
  { icon: Webhook, title: 'Recibe eventos', detail: 'Webhooks firmados te avisan de cada cobro pagado y cada envío liquidado.' },
] as const;

export default async function DevelopersPortalPage() {
  const { user, serviceUnavailable, needsOnboarding } = await getOptionalAuthState();

  if (needsOnboarding) {
    redirect('/onboarding');
  }

  if (serviceUnavailable) {
    redirect('/login');
  }

  if (user) {
    redirect('/developer-console');
  }

  return (
    <main>
      <section className="mx-auto flex max-w-6xl flex-col justify-center px-2 py-16 sm:px-6 sm:py-20">
        <div className="max-w-4xl">
          {/* El logotipo ya va en la cabecera del layout: aquí solo la etiqueta. */}
          <span className="mb-6 inline-flex rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Portal de desarrolladores
          </span>

          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Cobra y envía dinero a billeteras FondosEG desde tus aplicaciones.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Da de alta tu aplicación, emite sus credenciales y conecta cobros, envíos y webhooks firmados
            con la misma seguridad que la app de FondosEG.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg" className="rounded-2xl px-6">
              <Link href="/developers-portal/register">
                Crear cuenta de desarrollador
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl px-6">
              <Link href="/developers-portal/login">Entrar al portal</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-2xl px-6">
              <Link href="/documentation">Leer documentación</Link>
            </Button>
          </div>
        </div>

        <ol className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PORTAL_STEPS.map((step, index) => (
            <li key={step.title} className="app-card p-6">
              <step.icon className="h-5 w-5 text-primary" />
              <p className="mt-4 text-sm font-semibold text-foreground">{index + 1}. {step.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
