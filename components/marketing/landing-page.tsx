'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  CheckCircle2,
  Globe2,
  ShieldCheck,
  Wallet,
  Waypoints,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AudienceKey = 'gestores' | 'alliances' | 'developers';
type TrackMarketingEvent = (action: string, payload?: Record<string, unknown>) => void;

const textStyles = {
  eyebrow: 'text-xs font-black uppercase tracking-[0.22em] text-pink-400/85 dark:text-pink-300/80',
  sectionTitle: 'text-3xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-4xl dark:text-white',
  sectionParagraph: 'text-base leading-7 text-slate-600 dark:text-white/65',
  cardTitle: 'text-2xl font-semibold leading-tight text-slate-950 dark:text-white',
  cardParagraph: 'text-sm leading-7 text-slate-600 dark:text-white/68',
  smallParagraph: 'text-sm leading-6 text-slate-600 dark:text-white/62',
};

const surfaceCardClass =
  'rounded-[2rem] border border-slate-200/70 bg-white/82 p-6 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,0.3)]';

const primaryButtonClass =
  'rounded-2xl bg-brand-gradient text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95';

const benefits = [
  {
    icon: Waypoints,
    title: 'Opera sin depender de WhatsApp ni hojas sueltas',
    description:
      'Centraliza saldo, validaciones, historial y seguimiento de transferencias para que tu equipo trabaje sobre una sola fuente de verdad.',
  },
  {
    icon: ShieldCheck,
    title: 'Controla cada envio antes de que se vuelva un problema',
    description:
      'Trabaja con permisos por rol, trazabilidad completa y procesos pensados para una operacion que no puede improvisar.',
  },
  {
    icon: BarChart3,
    title: 'Responde mas rapido y con mas contexto',
    description:
      'Consulta balances, estado de envios y actividad reciente sin perseguir capturas, chats o conciliaciones manuales.',
  },
];

const credibilityItems = [
  'Accesos por rol',
  'Verificacion OTP',
  'Historial auditable',
  'APIs y webhooks',
  'Panel en tiempo real',
  'Alertas operativas',
];

const useCases = [
  {
    icon: Wallet,
    title: 'Controla caja y liquidez por gestor',
    description: 'Visualiza balances, movimientos y exposicion operativa antes de que un desajuste te detenga en pleno ciclo.',
  },
  {
    icon: BellRing,
    title: 'Detecta incidencias con tiempo',
    description: 'Manten al equipo alineado con estados claros, alertas y seguimiento de cada transferencia registrada.',
  },
  {
    icon: Globe2,
    title: 'Coordina mejor entre caja, soporte y administracion',
    description: 'Da visibilidad compartida a gestores, clientes y administracion sin romper el orden del proceso.',
  },
];

const audienceTracks = [
  {
    key: 'gestores' as const,
    id: 'gestores-access',
    eyebrow: 'Operacion diaria',
    title: 'Para gestores y agencias',
    description:
      'Ideal si tu equipo registra envios, controla saldo, responde incidencias y necesita mas orden para operar cada dia.',
    bullets: [
      'Saldo y trazabilidad en un solo flujo.',
      'Menos dependencia de chats y conciliaciones manuales.',
      'Mas velocidad para atender clientes y resolver incidencias.',
    ],
    ctaLabel: 'Activar vista operativa',
    href: '#gestores-access',
    isPortal: false,
  },
  {
    key: 'alliances' as const,
    id: 'alliances-access',
    eyebrow: 'Expansion y negocio',
    title: 'Para aliados e inversionistas',
    description:
      'Util si quieres evaluar la operacion, entender el modelo, revisar capacidad de escalamiento o explorar una alianza.',
    bullets: [
      'Mayor visibilidad sobre procesos y madurez operativa.',
      'Narrativa clara para presentar el producto y su crecimiento.',
      'Entrada simple para iniciar conversacion comercial.',
    ],
    ctaLabel: 'Activar vista comercial',
    href: '#alliances-access',
    isPortal: false,
  },
  {
    key: 'developers' as const,
    id: 'developers-portal',
    eyebrow: 'Integracion tecnica',
    title: 'Para developers e integradores API',
    description:
      'Pensado para equipos que necesitan credenciales, OpenAPI, SDK y webhooks para conectar FondosEG con otro sistema.',
    bullets: [
      'Portal publico de desarrolladores.',
      'Credenciales, documentacion y uso de API.',
      'Ruta directa para equipos tecnicos sin friccion comercial.',
    ],
    ctaLabel: 'Activar vista tecnica',
    href: '/developers-portal',
    isPortal: true,
  },
] as const;

const landingNav = [
  { label: 'Beneficios', href: '#beneficios' },
  { label: 'Audiencias', href: '#audiencias' },
  { label: 'Accesos', href: '#accesos' },
] as const;

const footerLinks = [
  { label: 'Privacidad', href: '/privacy' },
  { label: 'Politicas', href: '/policies' },
  { label: 'Cookies', href: '/cookies' },
  { label: 'Portal developers', href: '/developers-portal' },
] as const;

const audienceHero = {
  gestores: {
    selector: 'Gestores',
    badge: 'Plataforma operativa para redes de transferencias',
    title: 'Gestiona envios, saldo y seguimiento operativo desde una sola pantalla.',
    description:
      'FondosEG ayuda a gestores y equipos operativos a trabajar con mas orden, menos retrabajo y mejor visibilidad sobre cada movimiento de dinero.',
    formAction: '/register',
    formRole: 'gestor',
    formButton: 'Solicitar acceso operativo',
    helperPrimary: 'Entrada rapida para equipos operativos',
    helperSecondary: 'Lista para caja, soporte y administracion',
    topLabel: 'Operacion activa',
    topValue: '78,351',
    topMeta: '+4.7% hoy',
    sideLabel: 'Balance listo',
    sideValue: '$73,800',
    sideMeta: 'Cobertura operativa al 76%',
    welcomeEyebrow: 'Hola, equipo',
    welcomeTitle: 'Bienvenidos a FondosEG',
    mainLabel: 'Balance total',
    mainValue: '$12,420.22',
    mainBadge: '+24%',
    mainDescription: 'Caja, transferencias y seguimiento desde el mismo panel.',
    tabs: ['Fondos', 'Enviar', 'Convertir'],
    grid: [
      ['USD', '78,351', '+2.1%'],
      ['EUR', '32,391', '-1.3%'],
      ['Historial', '1,284', 'Registros'],
      ['Alertas', '08', 'Activas'],
    ],
    priorityTitle: 'Prioridad de hoy',
    priorityDescription: 'Resolver incidencias y confirmar pagos sin perder trazabilidad.',
    footer: 'Visibilidad compartida entre caja, gestor, soporte y administracion',
  },
  alliances: {
    selector: 'Aliados',
    badge: 'Visibilidad para expansion, alianzas e inversion',
    title: 'Evalua una operacion mas ordenada, escalable y lista para crecer.',
    description:
      'FondosEG presenta una lectura clara de la operacion para aliados e inversionistas que necesitan entender procesos, madurez y capacidad de expansion.',
    formAction: '/register',
    formRole: 'cliente',
    formButton: 'Solicitar presentacion',
    helperPrimary: 'Entrada inicial para conversaciones comerciales',
    helperSecondary: 'Ideal para evaluar modelo, capacidad y crecimiento',
    topLabel: 'Red visible',
    topValue: '12 sedes',
    topMeta: 'Operacion coordinada',
    sideLabel: 'Capacidad estimada',
    sideValue: '$73,800',
    sideMeta: 'Cobertura operativa monitoreada',
    welcomeEyebrow: 'Hola, aliados',
    welcomeTitle: 'Panorama de FondosEG',
    mainLabel: 'Volumen observado',
    mainValue: '$12,420.22',
    mainBadge: 'Escalable',
    mainDescription: 'Una lectura mas clara de operacion, crecimiento y control.',
    tabs: ['Cobertura', 'Expansion', 'Riesgo'],
    grid: [
      ['Gestores', '12', 'Activos'],
      ['Ciudades', '08', 'Cobertura'],
      ['Historial', '1,284', 'Operaciones'],
      ['Alertas', '03', 'Criticas'],
    ],
    priorityTitle: 'Enfoque actual',
    priorityDescription: 'Entender crecimiento, continuidad operativa y capacidad de expansion.',
    footer: 'Visibilidad compartida para presentar operacion, madurez y crecimiento',
  },
  developers: {
    selector: 'Developers',
    badge: 'Integracion tecnica con APIs, SDK y webhooks',
    title: 'Conecta FondosEG con tu sistema desde un portal tecnico listo para integracion.',
    description:
      'El recorrido tecnico cambia: entras por el portal de developers, generas credenciales, revisas OpenAPI y pruebas webhooks firmados sin pasar por un flujo comercial largo.',
    formAction: '/developers-portal/register',
    formRole: 'cliente',
    formButton: 'Crear cuenta de developer',
    helperPrimary: 'Portal publico de developers',
    helperSecondary: 'Credenciales, OpenAPI, SDK y webhooks en un solo lugar',
    topLabel: 'Requests hoy',
    topValue: '12,481',
    topMeta: '99.97% uptime',
    sideLabel: 'Webhook health',
    sideValue: '04 hooks',
    sideMeta: 'Firmas activas',
    welcomeEyebrow: 'Hola, integrador',
    welcomeTitle: 'Developer Portal',
    mainLabel: 'Stack de integracion',
    mainValue: 'OpenAPI + SDK',
    mainBadge: 'Listo',
    mainDescription: 'Credenciales, docs y eventos para conectar backend, portal o app movil.',
    tabs: ['API Keys', 'Webhooks', 'Docs'],
    grid: [
      ['OpenAPI', 'v1', 'Schema'],
      ['SDK', 'TS', 'Client'],
      ['Logs', '1,284', 'Requests'],
      ['Hooks', '08', 'Events'],
    ],
    priorityTitle: 'Siguiente paso',
    priorityDescription: 'Emitir credenciales, probar endpoints y suscribir webhooks firmados.',
    footer: 'Integra backend, portal o app movil sin empezar desde cero',
  },
} satisfies Record<AudienceKey, {
  selector: string;
  badge: string;
  title: string;
  description: string;
  formAction: string;
  formRole: string;
  formButton: string;
  helperPrimary: string;
  helperSecondary: string;
  topLabel: string;
  topValue: string;
  topMeta: string;
  sideLabel: string;
  sideValue: string;
  sideMeta: string;
  welcomeEyebrow: string;
  welcomeTitle: string;
  mainLabel: string;
  mainValue: string;
  mainBadge: string;
  mainDescription: string;
  tabs: [string, string, string];
  grid: [string, string, string][];
  priorityTitle: string;
  priorityDescription: string;
  footer: string;
}>;

type AudienceHeroContent = (typeof audienceHero)[AudienceKey];

export function LandingPage() {
  const [activeAudience, setActiveAudience] = useState<AudienceKey>('gestores');
  const [sessionId, setSessionId] = useState('');
  const { resolvedTheme } = useTheme();
  const activeHero = audienceHero[activeAudience];

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem('fondoseg_marketing_session');
    if (stored) {
      setSessionId(stored);
      return;
    }

    const nextId = window.crypto?.randomUUID?.() ?? `landing-${Date.now()}`;
    window.localStorage.setItem('fondoseg_marketing_session', nextId);
    setSessionId(nextId);
  }, []);

  function trackMarketingEvent(action: string, payload?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;

    const body = JSON.stringify({
      action,
      audience: activeAudience,
      session_id: sessionId || undefined,
      theme: resolvedTheme || 'system',
      pathname: window.location.pathname,
      ...payload,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/marketing/track', new Blob([body], { type: 'application/json' }));
      return;
    }

    void fetch('/api/marketing/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  }

  return (
    <main
      suppressHydrationWarning
      className="flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#fff7fb_0%,#f8fbff_42%,#ffffff_100%)] font-sans text-slate-950 dark:bg-[linear-gradient(180deg,#12060b_0%,#08080a_42%,#000000_100%)] dark:text-white"
    >
      <LandingBackground />
      <LandingHeader trackMarketingEvent={trackMarketingEvent} />

      <div className="relative z-10 flex min-h-screen flex-1 flex-col pt-16 md:pt-20">
        <HeroSection
          activeAudience={activeAudience}
          activeHero={activeHero}
          setActiveAudience={setActiveAudience}
          trackMarketingEvent={trackMarketingEvent}
        />

        <LandingSections
          activeAudience={activeAudience}
          setActiveAudience={setActiveAudience}
          trackMarketingEvent={trackMarketingEvent}
        />

        <LandingFooter trackMarketingEvent={trackMarketingEvent} />
      </div>
    </main>
  );
}

function LandingBackground() {
  return (
    <div className="fixed inset-0 hidden overflow-hidden pointer-events-none md:block">
      <div className="absolute top-0 left-0 h-full w-full">
        <div className="absolute -top-24 left-12 h-[32rem] w-[32rem] rounded-full bg-pink-100/70 blur-3xl dark:bg-pink-500/10" />
        <div className="absolute right-4 top-20 h-[34rem] w-[34rem] rounded-full bg-rose-100/70 blur-3xl dark:bg-rose-500/10" />
        <div className="absolute bottom-0 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-white/70 blur-3xl dark:bg-white/5" />
      </div>
    </div>
  );
}

function LandingHeader({
  trackMarketingEvent,
}: {
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 transition-all duration-300 md:h-20">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2"
          onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Logo header', target: '/' })}
        >
          <DashboardLogo priority size="md" labelClassName="text-xl md:text-2xl" />
        </Link>

        <nav className="hidden items-center justify-center gap-1 rounded-full border border-white/70 bg-white/56 px-2 py-1 shadow-sm shadow-slate-200/60 backdrop-blur-xl lg:flex dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
          {landingNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => trackMarketingEvent('landing_cta_click', { cta: `Header ${item.label}`, target: item.href })}
              className="rounded-full px-5 py-2 text-xs font-semibold text-slate-600 transition-all duration-300 hover:bg-white hover:text-pink-600 dark:text-white/68 dark:hover:bg-white/[0.08] dark:hover:text-pink-300"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <Button
            asChild
            variant="ghost"
            className="hidden h-10 rounded-full px-4 text-sm font-semibold text-slate-600 transition-all duration-300 hover:bg-white hover:text-pink-600 sm:inline-flex dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-pink-300"
          >
            <Link
              href="/login"
              onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Entrar', target: '/login' })}
            >
              Entrar
            </Link>
          </Button>
          <Button
            asChild
            className="h-10 rounded-full bg-brand-gradient px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_36px_rgba(236,72,153,0.28)] hover:opacity-95 md:px-5"
          >
            <a
              href="#accesos"
              onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Header solicitar acceso', target: '#accesos' })}
            >
              Acceso <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroSection({
  activeAudience,
  activeHero,
  setActiveAudience,
  trackMarketingEvent,
}: {
  activeAudience: AudienceKey;
  activeHero: AudienceHeroContent;
  setActiveAudience: (audience: AudienceKey) => void;
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col items-center overflow-hidden px-4 pb-0 pt-8 sm:px-6 md:min-h-[calc(100svh-5rem)] lg:px-8">
      <HeroOrbits />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/64 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm shadow-slate-200/60 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:shadow-none">
          <SparkBadge />
          {activeHero.badge}
        </div>

        <AudienceSelector
          activeAudience={activeAudience}
          setActiveAudience={setActiveAudience}
          trackMarketingEvent={trackMarketingEvent}
        />

        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.04] tracking-tight text-slate-950 sm:text-5xl md:text-6xl dark:text-white">
          {activeHero.title}
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base dark:text-white/68">
          {activeHero.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="h-11 rounded-full bg-brand-gradient px-6 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_46px_rgba(236,72,153,0.30)] hover:opacity-95"
          >
            <Link
              href={`${activeHero.formAction}?role=${activeHero.formRole}`}
              onClick={() => trackMarketingEvent('landing_cta_click', { cta: activeHero.formButton, target: activeHero.formAction })}
            >
              {activeHero.formButton}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <a
            href="#audiencias"
            onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Explorar audiencias', target: '#audiencias' })}
            className="inline-flex h-11 items-center rounded-full border border-white/70 bg-white/58 px-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm shadow-slate-200/50 backdrop-blur-xl transition hover:bg-white hover:text-pink-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:shadow-none dark:hover:bg-white/[0.08]"
          >
            Ver rutas
          </a>
        </div>

        <div className="mt-5 hidden flex-wrap justify-center gap-2 sm:flex">
          {credibilityItems.slice(0, 4).map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/70 bg-white/48 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm shadow-slate-200/40 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55 dark:shadow-none"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <HeroVisual activeAudience={activeAudience} activeHero={activeHero} />
    </section>
  );
}

function HeroOrbits() {
  return (
    <>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_16%,rgba(236,72,153,0.14),transparent_30%),radial-gradient(circle_at_84%_26%,rgba(225,29,72,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(236,72,153,0.16),transparent_30%),radial-gradient(circle_at_84%_26%,rgba(225,29,72,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
      <div className="absolute left-1/2 top-[23rem] -z-10 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full border border-pink-200/50 dark:border-pink-300/10" />
      <div className="absolute left-1/2 top-[28rem] -z-10 h-[31rem] w-[31rem] -translate-x-1/2 rounded-full border border-rose-200/50 dark:border-rose-300/10" />
      <div className="absolute left-1/2 top-[34rem] -z-10 h-[19rem] w-[19rem] -translate-x-1/2 rounded-full border border-pink-100/70 dark:border-white/10" />
    </>
  );
}

function AudienceSelector({
  activeAudience,
  setActiveAudience,
  trackMarketingEvent,
}: {
  activeAudience: AudienceKey;
  setActiveAudience: (audience: AudienceKey) => void;
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {audienceTracks.map((track) => {
        const isActive = track.key === activeAudience;

        return (
          <button
            key={track.key}
            type="button"
            onClick={() => {
              setActiveAudience(track.key);
              trackMarketingEvent('landing_audience_select', {
                selected_audience: track.key,
                cta: track.ctaLabel,
              });
            }}
            className={cn(
              'rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition-all duration-300',
              isActive
                ? 'bg-brand-gradient text-white shadow-[0_14px_34px_rgba(236,72,153,0.26)]'
                : 'border border-white/70 bg-white/58 text-slate-500 shadow-sm shadow-slate-200/50 hover:bg-white hover:text-pink-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:shadow-none dark:hover:bg-white/[0.08] dark:hover:text-pink-300'
            )}
          >
            {audienceHero[track.key].selector}
          </button>
        );
      })}
    </div>
  );
}

function HeroVisual({
  activeAudience,
  activeHero,
}: {
  activeAudience: AudienceKey;
  activeHero: AudienceHeroContent;
}) {
  return (
    <div className="relative mx-auto mb-10 mt-8 h-[480px] w-full max-w-5xl sm:mb-14 sm:h-[540px] md:mt-6 lg:mb-16">
      <HeroMetricCard
        className="left-0 top-[38%] hidden sm:flex lg:left-12"
        code={activeAudience === 'developers' ? 'API' : 'USD'}
        title={activeHero.topLabel}
        primary={activeHero.topValue}
        meta={activeHero.topMeta}
      />
      <HeroMetricCard
        className="right-0 top-[55%] hidden sm:flex lg:right-10"
        code={activeAudience === 'developers' ? 'HOOK' : 'XAF'}
        title={activeHero.sideLabel}
        primary={activeHero.sideValue}
        meta={activeHero.sideMeta}
        reverse
      />

      <HeroPhone activeAudience={activeAudience} activeHero={activeHero} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-white via-white/80 to-transparent dark:from-black dark:via-black/75" />
    </div>
  );
}

function LandingSections({
  activeAudience,
  setActiveAudience,
  trackMarketingEvent,
}: {
  activeAudience: AudienceKey;
  setActiveAudience: (audience: AudienceKey) => void;
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8 lg:pt-16">
      <BenefitsSummary />
      <AudiencesSection
        activeAudience={activeAudience}
        setActiveAudience={setActiveAudience}
        trackMarketingEvent={trackMarketingEvent}
      />
      <OperationsSection />
      <AccessSection trackMarketingEvent={trackMarketingEvent} />
      <UrgencyBand trackMarketingEvent={trackMarketingEvent} />
    </section>
  );
}

function BenefitsSummary() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {benefits.map(({ icon: Icon, title, description }) => (
        <Card key={title} className={surfaceCardClass}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_18px_40px_rgba(236,72,153,0.22)]">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={cn('mt-5', textStyles.cardTitle)}>{title}</h3>
          <p className={cn('mt-3', textStyles.cardParagraph)}>{description}</p>
        </Card>
      ))}
    </div>
  );
}

function AudiencesSection({
  activeAudience,
  setActiveAudience,
  trackMarketingEvent,
}: {
  activeAudience: AudienceKey;
  setActiveAudience: (audience: AudienceKey) => void;
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <div id="audiencias" className="mt-20 scroll-mt-28">
      <SectionHeading
        eyebrow="Tres rutas, misma plataforma"
        title="Una landing, tres publicos y un mensaje claro para cada uno."
        description="En lugar de forzar un solo discurso, FondosEG presenta una entrada util para quien opera la red, para quien evalua una alianza y para quien necesita integrar la API."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {audienceTracks.map((track) => {
          const isActive = track.key === activeAudience;

          return (
            <Card
              key={track.id}
              className={cn(
                surfaceCardClass,
                isActive && 'border-pink-400/40 bg-white shadow-[0_18px_50px_rgba(236,72,153,0.16)] dark:bg-white/[0.08]'
              )}
            >
              <p className={textStyles.eyebrow}>{track.eyebrow}</p>
              <h3 className={cn('mt-4', textStyles.cardTitle)}>{track.title}</h3>
              <p className={cn('mt-3', textStyles.cardParagraph)}>{track.description}</p>

              <div className="mt-5 space-y-3">
                {track.bullets.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-600 dark:text-white/75">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pink-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setActiveAudience(track.key);
                    trackMarketingEvent('landing_cta_click', {
                      cta: track.ctaLabel,
                      target: track.isPortal ? track.href : track.id,
                      selected_audience: track.key,
                    });
                  }}
                  className={cn('h-12 px-5', primaryButtonClass)}
                >
                  {track.ctaLabel}
                </Button>
                {track.isPortal && (
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-2xl border-slate-200/70 bg-white/80 px-5 text-sm font-black uppercase tracking-[0.16em] text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
                  >
                    <Link
                      href={track.href}
                      onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Abrir portal', target: track.href, selected_audience: track.key })}
                    >
                      Abrir portal
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OperationsSection() {
  const operationsBullets = [
    'Sabras que saldo tiene cada gestor y que movimientos estan pendientes.',
    'Podras responder al cliente sin abrir varias conversaciones o archivos.',
    'Tendras historial, validacion y seguimiento en el mismo flujo.',
    'Podras escalar la operacion con mas orden y menos dependencia de memoria humana.',
  ];

  return (
    <div id="beneficios" className="mt-20 grid gap-8 scroll-mt-28 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
      <div>
        <SectionHeading
          eyebrow="Hecho para operacion real"
          title="Lo que gana tu equipo cuando deja atras el control manual."
          description="La propuesta no se queda en funciones sueltas. Esta pensada para resolver tres dolores concretos de una operacion diaria: visibilidad, coordinacion y velocidad de respuesta."
        />

        <div className="mt-8 space-y-4">
          {operationsBullets.map((item) => (
            <div key={item} className="flex items-start gap-3 text-slate-600 dark:text-white/75">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pink-400" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {useCases.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-[1.75rem] border border-slate-200/70 bg-white/82 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/70 bg-white dark:border-white/10 dark:bg-white/[0.06]">
              <Icon className="h-5 w-5 text-pink-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold leading-tight text-slate-950 dark:text-white">{title}</h3>
            <p className={cn('mt-2', textStyles.smallParagraph)}>{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessSection({ trackMarketingEvent }: { trackMarketingEvent: TrackMarketingEvent }) {
  return (
    <div id="accesos" className="mt-20 grid gap-6 scroll-mt-28 lg:grid-cols-2">
      <AccessCard
        id="gestores-access"
        eyebrow="Acceso para operacion"
        title="Si eres gestor o agencia, entra por aqui."
        description="Crea tu acceso inicial y empieza a trabajar con saldo, trazabilidad y seguimiento desde un flujo mas ordenado."
        role="gestor"
        namePlaceholder="Nombre del responsable"
        emailPlaceholder="Correo de trabajo"
        buttonLabel="Crear acceso"
        section="gestores-access"
        trackMarketingEvent={trackMarketingEvent}
      />
      <AccessCard
        id="alliances-access"
        eyebrow="Acceso para alianzas"
        title="Si evaluas una alianza o inversion, empieza aqui."
        description="Deja tu correo para abrir una entrada inicial a la plataforma y revisar el negocio con mas contexto."
        role="cliente"
        namePlaceholder="Tu nombre"
        emailPlaceholder="Correo corporativo"
        buttonLabel="Solicitar presentacion"
        section="alliances-access"
        trackMarketingEvent={trackMarketingEvent}
      />
    </div>
  );
}

function AccessCard({
  id,
  eyebrow,
  title,
  description,
  role,
  namePlaceholder,
  emailPlaceholder,
  buttonLabel,
  section,
  trackMarketingEvent,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  role: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  buttonLabel: string;
  section: string;
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <Card id={id} className={surfaceCardClass}>
      <p className={textStyles.eyebrow}>{eyebrow}</p>
      <h3 className={cn('mt-4', textStyles.sectionTitle)}>{title}</h3>
      <p className={cn('mt-4 max-w-xl', textStyles.cardParagraph)}>{description}</p>

      <form
        action="/register"
        method="get"
        onSubmit={() => trackMarketingEvent('landing_form_submit', { cta: buttonLabel, target: '/register', section })}
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="role" value={role} />
        <Input
          name="name"
          placeholder={namePlaceholder}
          autoComplete="name"
          className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
        />
        <Input
          name="email"
          type="email"
          placeholder={emailPlaceholder}
          autoComplete="email"
          required
          className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
        />
        <Button type="submit" className={cn('h-12 px-6 sm:h-14', primaryButtonClass)}>
          {buttonLabel}
        </Button>
      </form>
    </Card>
  );
}

function UrgencyBand({ trackMarketingEvent }: { trackMarketingEvent: TrackMarketingEvent }) {
  return (
    <div className="mt-20 rounded-[2.5rem] border border-slate-200/70 bg-white/82 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-8 lg:p-10 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
      <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className={textStyles.eyebrow}>Urgencia operativa</p>
          <h2 className={cn('mt-4 max-w-2xl', textStyles.sectionTitle)}>
            Cada jornada que sigues resolviendo a mano te cuesta tiempo, foco y margen de respuesta.
          </h2>
          <p className={cn('mt-4 max-w-2xl', textStyles.sectionParagraph)}>
            Si hoy tu operacion depende de chats, memoria y conciliaciones manuales, el mejor momento para ordenar el proceso es antes del proximo pico de trabajo.
          </p>
        </div>

        <Button asChild className={cn('h-14 px-8', primaryButtonClass)}>
          <a
            href="#accesos"
            onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Solicitar acceso', target: '#accesos', section: 'urgency-footer' })}
          >
            Solicitar acceso
          </a>
        </Button>
      </div>
    </div>
  );
}

function LandingFooter({ trackMarketingEvent }: { trackMarketingEvent: TrackMarketingEvent }) {
  return (
    <footer className="relative z-10 mt-auto min-h-[340px] w-full border-t border-slate-200/80 bg-white/88 px-4 py-12 shadow-[0_-24px_80px_rgba(15,23,42,0.05)] backdrop-blur-xl sm:px-6 lg:px-8 dark:border-white/10 dark:bg-black/42 dark:shadow-black/20">
      <div className="mx-auto flex h-full max-w-7xl flex-col justify-between gap-10">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <DashboardLogo size="md" labelClassName="text-3xl" />
            <p className={cn('mt-4 max-w-xl', textStyles.cardParagraph)}>
              FondosEG organiza operacion, seguimiento y acceso tecnico en una sola plataforma para equipos que necesitan control real y capacidad de crecimiento.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className={cn('h-11 px-5', primaryButtonClass)}>
                <a
                  href="#accesos"
                  onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Footer solicitar acceso', target: '#accesos' })}
                >
                  Solicitar acceso
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-2xl border-slate-200/80 bg-white/82 px-5 text-sm font-black uppercase tracking-[0.16em] text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
              >
                <Link
                  href="/developers-portal"
                  onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Footer developers portal', target: '/developers-portal' })}
                >
                  Developers portal
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <FooterLinkGroup title="Navegacion" trackMarketingEvent={trackMarketingEvent} />
            <FooterResourceGroup trackMarketingEvent={trackMarketingEvent} />
          </div>
        </div>

        <div className="border-t border-slate-200/80 pt-5 text-center text-sm text-slate-500 dark:border-white/10 dark:text-white/55">
          <span>FondosEG. Plataforma de operacion, control y acceso tecnico.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  title,
  trackMarketingEvent,
}: {
  title: string;
  trackMarketingEvent: TrackMarketingEvent;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">{title}</p>
      <div className="mt-4 flex flex-col gap-3">
        {landingNav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={() => trackMarketingEvent('landing_cta_click', { cta: `Footer ${item.label}`, target: item.href })}
            className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-white/68 dark:hover:text-white"
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function FooterResourceGroup({ trackMarketingEvent }: { trackMarketingEvent: TrackMarketingEvent }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">Recursos</p>
      <div className="mt-4 flex flex-col gap-3">
        {footerLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => trackMarketingEvent('landing_cta_click', { cta: `Footer ${item.label}`, target: item.href })}
            className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-white/68 dark:hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className={textStyles.eyebrow}>{eyebrow}</p>
      <h2 className={cn('mt-4', textStyles.sectionTitle)}>{title}</h2>
      <p className={cn('mt-5', textStyles.sectionParagraph)}>{description}</p>
    </div>
  );
}

function SparkBadge() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-white shadow-[0_10px_30px_rgba(236,72,153,0.25)]">
      <BadgeCheck className="h-3.5 w-3.5" />
    </span>
  );
}

function HeroMetricCard({
  className,
  code,
  title,
  primary,
  meta,
  reverse = false,
}: {
  className?: string;
  code: string;
  title: string;
  primary: string;
  meta: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute z-20 w-[250px] items-center gap-4 rounded-2xl border border-white/75 bg-white/86 p-4 text-left shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.07] dark:shadow-black/30',
        reverse && 'flex-row-reverse text-right',
        className
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-black uppercase tracking-[0.08em] text-white shadow-[0_14px_32px_rgba(236,72,153,0.28)]">
        {code.slice(0, 4)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-900 dark:text-white">{title}</p>
        <div className={cn('mt-1 flex items-baseline justify-between gap-3', reverse && 'flex-row-reverse')}>
          <span className="text-xl font-semibold text-slate-950 dark:text-white">{primary}</span>
          <span className="text-[11px] font-semibold text-pink-500 dark:text-pink-300">{meta}</span>
        </div>
      </div>
    </div>
  );
}

function HeroPhone({
  activeAudience,
  activeHero,
}: {
  activeAudience: AudienceKey;
  activeHero: AudienceHeroContent;
}) {
  return (
    <div className="absolute left-1/2 top-0 z-10 h-[500px] w-[245px] -translate-x-1/2 sm:h-[560px] sm:w-[278px]">
      <div className="absolute left-1/2 top-4 h-[92%] w-[72%] -translate-x-1/2 rounded-full bg-[rgba(15,23,42,0.22)] blur-3xl dark:bg-black/70" />
      <div className="relative mx-auto h-full rounded-[2.45rem] border-[9px] border-slate-950 bg-slate-950 p-2 shadow-[0_38px_90px_rgba(15,23,42,0.24)] dark:border-slate-900 dark:shadow-black/60">
        <div className="absolute left-1/2 top-3 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full overflow-hidden rounded-[1.85rem] bg-[linear-gradient(180deg,#fff7fb_0%,#ffffff_45%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#181014_0%,#0b0b0d_54%,#060606_100%)]">
          <div className="flex items-center justify-between bg-brand-gradient px-4 pb-4 pt-5 text-white">
            <DashboardLogo size="sm" showLabel={false} iconClassName="h-7 w-7" />
            <div className="flex items-center gap-1.5">
              <span className="h-6 w-6 rounded-full bg-white/24" />
              <span className="h-6 w-6 rounded-full bg-white/24" />
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="rounded-2xl bg-slate-950 p-4 text-white shadow-[0_18px_42px_rgba(15,23,42,0.22)] dark:bg-black">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pink-200">{activeHero.priorityTitle}</p>
              <p className="mt-2 text-sm font-semibold leading-5">{activeHero.priorityDescription}</p>
              <div className="mt-4 h-1.5 rounded-full bg-white/10">
                <div className="h-1.5 w-3/4 rounded-full bg-brand-gradient" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-white/45">{activeHero.welcomeEyebrow}</p>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{activeHero.welcomeTitle}</h2>
              </div>
              <span className="rounded-full bg-brand-gradient px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                {activeHero.mainBadge}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm shadow-slate-200/80 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">{activeHero.mainLabel}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{activeHero.mainValue}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-white/50">{activeHero.mainDescription}</p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {activeHero.tabs.map((tab, index) => (
                <div
                  key={tab}
                  className={cn(
                    'rounded-xl px-2 py-2 text-center text-[10px] font-black',
                    index === 0
                      ? 'bg-brand-gradient text-white'
                      : 'border border-slate-200/80 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/62'
                  )}
                >
                  {tab}
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {activeHero.grid.slice(0, 4).map(([label, value, meta]) => (
                <div
                  key={label}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-200/70 bg-white/86 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="font-semibold text-slate-700 dark:text-white/76">{label}</span>
                  <span className="font-semibold text-slate-950 dark:text-white">{value}</span>
                  <span className={cn('text-[10px]', activeAudience === 'gestores' ? 'text-emerald-500' : 'text-pink-400')}>{meta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
