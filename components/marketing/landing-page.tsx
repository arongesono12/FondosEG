'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Code2,
  Headphones,
  Landmark,
  ShieldCheck,
  TrendingUp,
  WalletCards,
  Zap,
} from 'lucide-react';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type LandingRole = 'gestores' | 'aliados' | 'developers';

const primaryButtonClass =
  'h-12 rounded-2xl bg-brand-gradient px-6 text-sm font-bold text-white shadow-xl shadow-pink-500/20 hover:scale-[1.01]';

const secondaryButtonClass =
  'h-12 rounded-2xl border-border/20 bg-white/60 px-6 text-sm font-bold text-foreground backdrop-blur-md hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10';

const eyebrowClass = 'text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground';

const panelClass = 'glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5';

const stats = [
  { value: '250K+', label: 'transacciones procesadas' },
  { value: '$12.5M', label: 'dinero movido en 2024' },
  { value: '99.9%', label: 'seguimiento operativo' },
];

const testimonials = [
  {
    quote: 'FondosEG nos dio una forma más clara de mover dinero, revisar estados y cerrar el día sin perder contexto.',
    author: 'Equipo operativo',
    label: 'Red de gestores',
  },
  {
    quote: 'La trazabilidad cambió la conversación: ahora vemos el flujo completo antes de escalar una incidencia.',
    author: 'Dirección financiera',
    label: 'Partner regional',
  },
];

const features = [
  {
    icon: Zap,
    title: 'Transferencias al instante',
    description: 'Registra, valida y consulta movimientos en un flujo rápido para equipos que operan cada minuto.',
  },
  {
    icon: ShieldCheck,
    title: 'Sin comisiones ocultas',
    description: 'Condiciones claras, saldos visibles y trazabilidad para que cada operación llegue con contexto.',
  },
  {
    icon: Headphones,
    title: 'Soporte 24/7',
    description: 'Seguimiento continuo para incidencias, estados de transferencia y coordinación entre equipos.',
  },
];

const roles = {
  gestores: {
    eyebrow: 'Para operadores de dinero',
    title: 'Opera transferencias con más velocidad y menos fricción',
    description:
      'Una página enfocada en gestores, agencias y equipos que necesitan controlar caja, saldos, clientes y estados de envío desde un único lugar.',
    href: '/landing/gestores',
    icon: WalletCards,
    bullets: ['Control de saldo por gestor', 'Historial auditable', 'Flujo simple para caja y soporte'],
  },
  aliados: {
    eyebrow: 'Para inversores y partners',
    title: 'Evalúa una red lista para escalar',
    description:
      'Una vista clara para aliados comerciales, inversores y partners que quieren entender el volumen, el modelo operativo y las oportunidades de crecimiento.',
    href: '/landing/aliados',
    icon: TrendingUp,
    bullets: ['Métricas de crecimiento', 'Modelo operativo transparente', 'Entrada directa para alianzas'],
  },
  developers: {
    eyebrow: 'Portal técnico',
    title: 'Conecta FondosEG con tus sistemas',
    description:
      'Documentación, APIs, webhooks y rutas técnicas para equipos que quieren integrar transferencias y consultas en productos externos.',
    href: '/landing/developers',
    icon: Code2,
    bullets: ['API pública', 'Webhooks y credenciales', 'SDK y documentación técnica'],
  },
} satisfies Record<
  LandingRole,
  {
    eyebrow: string;
    title: string;
    description: string;
    href: string;
    icon: typeof WalletCards;
    bullets: string[];
  }
>;

const roleDetails = {
  gestores: {
    heroLabel: 'Para operadores de dinero',
    headline: 'Más control para equipos que mueven dinero todos los días',
    summary:
      'Diseñado para gestores y agencias que necesitan registrar transferencias, revisar saldos y resolver incidencias sin depender de chats dispersos.',
    proof: 'Reduce tareas manuales y acelera el seguimiento operativo.',
    points: ['Caja y liquidez visibles por gestor', 'Estados claros por cada transferencia', 'Permisos por rol para equipos operativos'],
  },
  aliados: {
    heroLabel: 'Para inversores y partners',
    headline: 'Una operación medible para crecer con aliados',
    summary:
      'Presenta volumen, trazabilidad y madurez operativa para partners que quieren invertir, distribuir o construir sobre la red FondosEG.',
    proof: '$12.5M movidos en 2024 con procesos auditables.',
    points: ['Indicadores de volumen y adopción', 'Visibilidad del modelo operativo', 'Ruta comercial para nuevas alianzas'],
  },
  developers: {
    heroLabel: 'Portal técnico',
    headline: 'APIs, webhooks y documentación para integrar transferencias',
    summary:
      'Una entrada técnica para crear credenciales, revisar OpenAPI y conectar FondosEG con plataformas externas con menos fricción.',
    proof: 'Portal pensado para equipos técnicos y productos integrados.',
    points: ['Documentación OpenAPI', 'Webhooks para estados y eventos', 'SDK TypeScript disponible'],
  },
} satisfies Record<
  LandingRole,
  {
    heroLabel: string;
    headline: string;
    summary: string;
    proof: string;
    points: string[];
  }
>;

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 h-16 w-full transition-all duration-300 md:h-20',
        scrolled
          ? 'border-b border-transparent bg-transparent shadow-none backdrop-blur-0'
          : 'border-b border-border/10 bg-white/30 shadow-sm shadow-black/5 backdrop-blur-xl dark:bg-black/20'
      )}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[1440px] items-center justify-between px-4 md:px-10">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="FondosEG inicio">
            <DashboardLogo size="md" priority labelClassName="text-xl md:text-2xl" />
          </Link>
        </div>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          <Link className="rounded-full px-5 py-2 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-pink-100 hover:text-pink-600 dark:hover:bg-pink-500/20 dark:hover:text-pink-400" href="/landing/gestores">
            Gestores
          </Link>
          <Link className="rounded-full px-5 py-2 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-pink-100 hover:text-pink-600 dark:hover:bg-pink-500/20 dark:hover:text-pink-400" href="/landing/aliados">
            Aliados
          </Link>
          <Link className="rounded-full px-5 py-2 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-pink-100 hover:text-pink-600 dark:hover:bg-pink-500/20 dark:hover:text-pink-400" href="/landing/developers">
            Developers
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-muted-foreground md:gap-3">
          <ThemeToggle />
          <Button asChild className="hidden h-10 rounded-full bg-brand-gradient px-5 text-sm font-bold text-white shadow-lg shadow-pink-500/20 sm:inline-flex">
            <Link href="/register">Comenzar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function LandingShell({ children }: { children: ReactNode }) {
  return (
    <main suppressHydrationWarning className="main-container min-h-screen bg-white font-sans text-foreground dark:bg-black">
      <div className="pointer-events-none fixed inset-0 hidden overflow-hidden md:block">
        <div className="absolute left-20 top-20 h-96 w-96 rounded-full bg-pink-100/60 blur-3xl dark:bg-pink-500/10" />
        <div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-rose-100/60 blur-3xl dark:bg-rose-500/10" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-50/50 blur-3xl dark:bg-pink-600/5" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full flex-col overflow-hidden bg-white pt-16 dark:bg-black md:min-h-[calc(100vh-4rem)] md:max-w-[1440px] md:rounded-[2.5rem] md:border md:border-border/10 md:bg-transparent md:pt-20 md:shadow-xl md:shadow-slate-200/20 dark:md:shadow-black/20">
        <Header />
        <div className="flex-1 overflow-hidden bg-white dark:bg-black md:bg-transparent">
          {children}
          <MarketingFooter />
        </div>
      </div>
    </main>
  );
}

function FinalCta({ compact = false }: { compact?: boolean }) {
  return (
    <section className="px-4 py-8 md:px-10 md:py-10">
      <div
        className={cn(
          'mx-auto grid max-w-7xl gap-8 rounded-4xl border p-6 sm:p-8 lg:grid-cols-[1fr_420px] lg:items-center',
          compact
            ? 'glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5'
            : 'border-border/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.86),rgba(248,250,252,0.72))] shadow-2xl shadow-slate-200/40 backdrop-blur-xl dark:bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.88),rgba(2,6,23,0.82))] dark:shadow-black/20'
        )}
      >
        <div>
          <p className={eyebrowClass}>CTA simple</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Comienza con FondosEG</h2>
          <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-muted-foreground">
            Deja tu email y te mostramos el flujo completo para mover dinero con conexión directa, sin intermediarios.
          </p>
        </div>
        <form className="flex flex-col gap-3 sm:flex-row" action="/register">
          <Input
            aria-label="Email"
            className="h-12 rounded-2xl border-border/20 bg-white/60 font-medium backdrop-blur-md dark:bg-white/5"
            name="email"
            placeholder="tu@email.com"
            type="email"
          />
          <Button className={primaryButtonClass} type="submit">
            Comenzar
            <ArrowRight />
          </Button>
        </form>
      </div>
    </section>
  );
}

function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/10 px-4 py-8 md:px-10 md:py-10">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div className="max-w-md">
          <DashboardLogo size="md" className="justify-start" labelClassName="text-xl" />
          <p className="mt-4 text-sm font-medium leading-7 text-muted-foreground">
            Infraestructura financiera para transferencias, billeteras, trazabilidad operativa e integraciones API con control de credenciales.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/10 bg-background/70 px-3 py-1 text-xs font-bold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-pink-500" />
              API segura
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/10 bg-background/70 px-3 py-1 text-xs font-bold text-foreground">
              <Code2 className="h-3.5 w-3.5 text-pink-500" />
              OpenAPI
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Producto</p>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-foreground/80">
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/landing/gestores">Gestores</Link>
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/landing/aliados">Aliados</Link>
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/landing/developers">Developers</Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Desarrolladores</p>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-foreground/80">
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/developers-portal">Portal API</Link>
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/api/docs/openapi.json">OpenAPI JSON</Link>
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/developers-portal/register">Crear cuenta</Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Cuenta</p>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-foreground/80">
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/login">Entrar</Link>
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/register">Registrarse</Link>
            <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/developers-portal/login">Login developers</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-border/10 pt-6 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} FondosEG. Todos los derechos reservados.</p>
        <div className="flex flex-wrap gap-4">
          <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/privacy">Privacidad</Link>
          <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/cookies">Cookies</Link>
          <Link className="transition hover:text-pink-600 dark:hover:text-pink-400" href="/policies">Políticas</Link>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <LandingShell>
      <section className="px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex w-fit rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              Conexión directa, sin intermediarios
            </span>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Transfiere más dinero en menos tiempo
            </h1>
            <p className="max-w-2xl text-base font-medium leading-7 text-muted-foreground md:text-lg md:leading-8">
              FondosEG conecta operación, control y seguimiento para que cada transferencia avance con claridad desde el primer registro.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className={primaryButtonClass}>
                <Link href="/register">
                  Comenzar gratis
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild className={secondaryButtonClass} variant="outline">
                <Link href="/developers-portal">Ver demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Image
              src="/mockup.png"
              alt="Vista del panel FondosEG"
              width={1040}
              height={780}
              priority
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-6 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className={cn(panelClass, 'rounded-4xl p-5')}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {testimonials.map((item) => (
              <Card key={item.quote} className={cn(panelClass, 'rounded-4xl p-6')}>
                <p className="text-base font-medium leading-7 text-foreground/80">&ldquo;{item.quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <BadgeCheck className="text-pink-500" />
                  <div>
                    <p className="font-semibold text-foreground">{item.author}</p>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className={eyebrowClass}>3 funciones core</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-foreground">Lo esencial para transferir mejor</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className={cn(panelClass, 'rounded-4xl p-6')}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-pink-500/20 bg-brand-gradient text-white shadow-lg shadow-pink-500/20">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className={eyebrowClass}>3 roles, 3 páginas</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-foreground">Cada audiencia entra por su puerta correcta</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {(Object.keys(roles) as LandingRole[]).map((key) => {
              const role = roles[key];
              return (
                <Link
                  key={key}
                  className={cn(panelClass, 'group rounded-4xl p-6 transition hover:-translate-y-1 hover:border-pink-500/30')}
                  href={role.href}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
                    <role.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{role.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-bold leading-tight text-foreground">{role.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-7 text-muted-foreground">{role.description}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-pink-600 dark:text-pink-400">
                    Ver página
                    <ArrowRight className="transition group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <FinalCta />
    </LandingShell>
  );
}

export function RoleLandingPage({ role }: { role: LandingRole }) {
  const detail = roleDetails[role];
  const roleMeta = roles[role];

  return (
    <LandingShell>
      <section className="px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex w-fit rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              {detail.heroLabel}
            </span>
            <h1 className="text-5xl font-bold leading-[1.03] tracking-tight text-foreground sm:text-6xl">
              {detail.headline}
            </h1>
            <p className="max-w-2xl text-base font-medium leading-7 text-muted-foreground md:text-lg md:leading-8">{detail.summary}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className={primaryButtonClass}>
                <Link href="/register">
                  Comenzar
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild className={secondaryButtonClass} variant="outline">
                <Link href={role === 'developers' ? '/developers-portal' : '/login'}>Ver demo</Link>
              </Button>
            </div>
          </div>

          <div className={cn(panelClass, 'rounded-4xl p-6')}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-pink-500/20">
              <roleMeta.icon className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground">{roleMeta.eyebrow}</h2>
            <p className="mt-3 text-base font-medium leading-7 text-muted-foreground">{detail.proof}</p>
            <div className="mt-6 grid gap-3">
              {detail.points.map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl border border-border/10 bg-primary/5 p-4">
                  <BadgeCheck className="mt-0.5 h-5 w-5 text-pink-500" />
                  <span className="text-sm font-medium text-foreground/75">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className={cn(panelClass, 'rounded-4xl p-6')}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-foreground">{feature.title}</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <div className={cn(panelClass, 'rounded-4xl p-5')}>
            <Clock3 className="h-7 w-7 text-pink-500" />
            <p className="mt-4 text-3xl font-bold">250K+</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">transacciones procesadas</p>
          </div>
          <div className={cn(panelClass, 'rounded-4xl p-5')}>
            <Landmark className="h-7 w-7 text-pink-500" />
            <p className="mt-4 text-3xl font-bold">$12.5M</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">dinero movido en 2024</p>
          </div>
          <div className={cn(panelClass, 'rounded-4xl p-5')}>
            <BadgeCheck className="h-7 w-7 text-pink-500" />
            <p className="mt-4 text-3xl font-bold">24/7</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">acompañamiento operativo</p>
          </div>
        </div>
      </section>

      <FinalCta compact />
    </LandingShell>
  );
}
