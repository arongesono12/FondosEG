'use client';

import Image from 'next/image';
import Link from 'next/link';
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
  'h-12 rounded-[8px] bg-brand-gradient px-6 text-sm font-bold text-white shadow-[0_16px_36px_rgba(225,29,72,0.22)] hover:opacity-95';

const secondaryButtonClass =
  'h-12 rounded-[8px] border-slate-200/80 bg-white/80 px-6 text-sm font-bold text-slate-950 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10';

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
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-background/85 backdrop-blur-xl dark:border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" aria-label="FondosEG inicio">
          <DashboardLogo size="md" priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 dark:text-white/70 md:flex">
          <Link className="hover:text-slate-950 dark:hover:text-white" href="/landing/gestores">
            Gestores
          </Link>
          <Link className="hover:text-slate-950 dark:hover:text-white" href="/landing/aliados">
            Aliados
          </Link>
          <Link className="hover:text-slate-950 dark:hover:text-white" href="/landing/developers">
            Developers
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="hidden h-10 rounded-[8px] px-4 font-bold sm:inline-flex">
            <Link href="/register">Comenzar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function FinalCta({ compact = false }: { compact?: boolean }) {
  return (
    <section className={cn('px-5 py-14 sm:px-8', compact ? 'pt-6' : 'bg-slate-950 text-white dark:bg-black')}>
      <div
        className={cn(
          'mx-auto grid max-w-7xl gap-8 rounded-[8px] border p-6 sm:p-8 lg:grid-cols-[1fr_420px] lg:items-center',
          compact
            ? 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.04]'
            : 'border-white/10 bg-white/[0.04]'
        )}
      >
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-400">CTA simple</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Comienza con FondosEG</h2>
          <p className={cn('mt-3 max-w-2xl text-base leading-7', compact ? 'text-slate-600 dark:text-white/65' : 'text-white/70')}>
            Deja tu email y te mostramos el flujo completo para mover dinero con conexión directa, sin intermediarios.
          </p>
        </div>
        <form className="flex flex-col gap-3 sm:flex-row" action="/register">
          <Input
            aria-label="Email"
            className={cn('h-12 rounded-[8px]', compact ? 'bg-transparent' : 'border-white/15 bg-white/10 text-white placeholder:text-white/45')}
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

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <Header />

      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-500">Conexión directa, sin intermediarios</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
              Transfiere más dinero en menos tiempo
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-white/68">
              FondosEG conecta operación, control y seguimiento para que cada transferencia avance con claridad desde el primer registro.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
            <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-white/[0.04]">
              <Image
                src="/mockup.png"
                alt="Vista del panel FondosEG"
                width={1040}
                height={780}
                priority
                className="h-auto w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/65 px-5 py-14 dark:border-white/10 dark:bg-white/[0.03] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className="rounded-[8px] border border-slate-200 bg-background p-5 dark:border-white/10">
                <p className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{item.value}</p>
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-white/64">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {testimonials.map((item) => (
              <Card key={item.quote} className="rounded-[8px] border-slate-200/80 bg-white p-6 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-base leading-7 text-slate-700 dark:text-white/74">&ldquo;{item.quote}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <BadgeCheck className="text-rose-500" />
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{item.author}</p>
                    <p className="text-sm text-slate-500 dark:text-white/50">{item.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-500">3 funciones core</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Lo esencial para transferir mejor</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="rounded-[8px] border-slate-200/80 bg-white p-6 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
                <feature.icon className="h-8 w-8 text-rose-500" />
                <h3 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/64">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-5 py-16 dark:bg-white/[0.02] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-500">3 roles, 3 páginas</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Cada audiencia entra por su puerta correcta</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {(Object.keys(roles) as LandingRole[]).map((key) => {
              const role = roles[key];
              return (
                <Link
                  key={key}
                  className="group rounded-[8px] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-rose-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-rose-400/60"
                  href={role.href}
                >
                  <role.icon className="h-8 w-8 text-rose-500" />
                  <p className="mt-5 text-sm font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-white/48">{role.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white">{role.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-white/64">{role.description}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-300">
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
    </main>
  );
}

export function RoleLandingPage({ role }: { role: LandingRole }) {
  const detail = roleDetails[role];
  const roleMeta = roles[role];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-rose-500">{detail.heroLabel}</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.03] tracking-tight text-slate-950 sm:text-6xl dark:text-white">
              {detail.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-white/68">{detail.summary}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

          <div className="rounded-[8px] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]">
            <roleMeta.icon className="h-10 w-10 text-rose-500" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{roleMeta.eyebrow}</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 dark:text-white/64">{detail.proof}</p>
            <div className="mt-6 grid gap-3">
              {detail.points.map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-[8px] bg-slate-50 p-4 dark:bg-white/[0.04]">
                  <BadgeCheck className="mt-0.5 h-5 w-5 text-rose-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-white/72">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/65 px-5 py-14 dark:border-white/10 dark:bg-white/[0.03] sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="rounded-[8px] border-slate-200/80 bg-white p-6 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
              <feature.icon className="h-7 w-7 text-rose-500" />
              <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/64">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <div className="rounded-[8px] border border-slate-200 p-5 dark:border-white/10">
            <Clock3 className="h-7 w-7 text-rose-500" />
            <p className="mt-4 text-3xl font-semibold">250K+</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/60">transacciones procesadas</p>
          </div>
          <div className="rounded-[8px] border border-slate-200 p-5 dark:border-white/10">
            <Landmark className="h-7 w-7 text-rose-500" />
            <p className="mt-4 text-3xl font-semibold">$12.5M</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/60">dinero movido en 2024</p>
          </div>
          <div className="rounded-[8px] border border-slate-200 p-5 dark:border-white/10">
            <BadgeCheck className="h-7 w-7 text-rose-500" />
            <p className="mt-4 text-3xl font-semibold">24/7</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/60">acompañamiento operativo</p>
          </div>
        </div>
      </section>

      <FinalCta compact />
    </main>
  );
}
