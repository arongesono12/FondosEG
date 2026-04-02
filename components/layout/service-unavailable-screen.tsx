import Link from 'next/link';
import { DashboardLogo } from './dashboard-logo';

interface ServiceUnavailableScreenProps {
  retryHref?: string;
  title?: string;
  description?: string;
}

export function ServiceUnavailableScreen({
  retryHref = '/',
  title = 'Servicio temporalmente no disponible',
  description = 'No pudimos conectar con Supabase en este momento. Revisa la red del servidor o intenta nuevamente en unos segundos.',
}: ServiceUnavailableScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-4xl border border-border/20 bg-card/90 backdrop-blur-xl shadow-2xl p-8 text-center">
        <DashboardLogo
          size="lg"
          className="justify-center mb-5"
          iconClassName="h-14 w-14 rounded-full"
        />
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <span className="text-2xl leading-none">!</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href={retryHref}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-gradient px-5 text-sm font-black text-white shadow-lg shadow-pink-500/20 transition-opacity hover:opacity-90"
          >
            Reintentar
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border/40 px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted/60"
          >
            Ir a login
          </Link>
        </div>
      </div>
    </div>
  );
}
