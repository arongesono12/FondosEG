import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
      <Card interactive={false} className="w-full max-w-lg rounded-4xl p-8 text-center">
        <DashboardLogo
          size="lg"
          className="justify-center mb-5"
          iconClassName="h-14 w-14 rounded-full"
          labelClassName="text-4xl"
        />
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <span className="text-2xl leading-none">!</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild size="xl" variant="brand" className="rounded-2xl">
            <Link href={retryHref}>Reintentar</Link>
          </Button>
          <Button asChild size="xl" variant="outline" className="rounded-2xl">
            <Link href="/login">Ir a login</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
