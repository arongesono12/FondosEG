import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, KeyRound, Webhook, BookOpen, Package } from 'lucide-react';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Button } from '@/components/ui/button';
import { getOptionalAuthState } from '@/lib/server/authz';

export default async function DevelopersPortalPage() {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    redirect('/login');
  }

  if (user) {
    redirect('/developers');
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-4xl">
          <div className="mb-8 flex items-center gap-3">
            <DashboardLogo size="md" priority className="justify-start" />
            <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
              Developer Portal
            </span>
          </div>

          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Regístrate, obtén tus credenciales y consume la API de FondosEG desde tu otro proyecto.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Este portal es la entrada pública para integradores. Desde aquí un desarrollador crea su cuenta,
            entra a su consola de APIs y administra claves, OpenAPI, SDK TypeScript y webhooks firmados.
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
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-6 backdrop-blur">
            <KeyRound className="h-5 w-5 text-pink-500" />
            <p className="mt-4 text-sm font-semibold text-foreground">1. Registro</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              El desarrollador entra por `/developers-portal/register` y crea su cuenta.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-6 backdrop-blur">
            <BookOpen className="h-5 w-5 text-pink-500" />
            <p className="mt-4 text-sm font-semibold text-foreground">2. Consola</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tras autenticarse entra a `/developers`, donde genera credenciales y revisa uso.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-6 backdrop-blur">
            <Package className="h-5 w-5 text-pink-500" />
            <p className="mt-4 text-sm font-semibold text-foreground">3. Integración</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Usa OpenAPI o el SDK TypeScript para conectar el otro proyecto con la API de FondosEG.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-6 backdrop-blur">
            <Webhook className="h-5 w-5 text-pink-500" />
            <p className="mt-4 text-sm font-semibold text-foreground">4. Eventos</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Configura webhooks firmados para recibir cambios de estado de transferencias.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-4 border-t border-border/60 pt-8 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <p className="font-semibold text-foreground">Acceso público</p>
            <p className="mt-2 break-all">/developers-portal</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">OpenAPI</p>
            <p className="mt-2 break-all">/api/docs/openapi.json</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">SDK</p>
            <p className="mt-2 break-all">sdk/typescript/fondoseg-sdk</p>
          </div>
        </div>
      </section>
    </main>
  );
}
