'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  CheckCircle2,
  Clock3,
  Code2,
  Globe2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Wallet,
  Webhook,
  Waypoints,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type AudienceKey = 'gestores' | 'alliances' | 'developers';

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

export function LandingPage() {
  const [activeAudience, setActiveAudience] = useState<AudienceKey>('gestores');
  const [sessionId, setSessionId] = useState('');
  const { resolvedTheme } = useTheme();
  const activeHero = audienceHero[activeAudience];
  const activeThemeLabel = resolvedTheme === 'dark' ? 'Modo oscuro' : 'Modo claro';

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
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_28%),linear-gradient(180deg,#fff8fc,#fff4f8_24%,#ffffff_58%,#fff9f6)] text-slate-950 transition-colors duration-500 dark:bg-[#050505] dark:text-white">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 h-[560px] bg-[rgba(236,72,153,0.10)] blur-[160px] dark:bg-[rgba(236,72,153,0.08)]" />
        <div className="absolute -left-24 top-32 h-72 w-72 rounded-full bg-[rgba(236,72,153,0.16)] blur-[120px] dark:bg-[rgba(236,72,153,0.12)]" />
        <div className="absolute -right-12 top-24 h-80 w-80 rounded-full bg-[rgba(225,29,72,0.14)] blur-[140px] dark:bg-[rgba(225,29,72,0.12)]" />

        <header className="relative z-20 mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/88 px-4 py-4 shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur transition-colors duration-500 sm:px-5 lg:flex-row lg:items-center lg:justify-between dark:border-white/10 dark:bg-white/[0.08] dark:shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-3"
                onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Logo header', target: '/' })}
              >
                <DashboardLogo size="md" labelClassName="text-xl sm:text-2xl" />
              </Link>

              <div className="flex items-center gap-3 lg:hidden">
                <div className="hidden min-w-[104px] sm:block">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/45">
                    Tema activo
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">
                    {activeThemeLabel}
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2 lg:justify-center">
              {landingNav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => trackMarketingEvent('landing_cta_click', { cta: `Header ${item.label}`, target: item.href })}
                  className="rounded-full border border-slate-200/80 bg-white/78 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/72 dark:shadow-none dark:hover:bg-white/[0.08] dark:hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              <div className="hidden min-w-[112px] lg:block">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/45">
                  Tema activo
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">
                  {activeThemeLabel}
                </p>
              </div>
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-2xl border-slate-200/80 bg-white/82 px-5 text-sm font-black uppercase tracking-[0.16em] text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
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
                className="h-11 rounded-2xl bg-brand-gradient px-5 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95"
              >
                <a
                  href="#lead-form"
                  onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Header solicitar acceso', target: '#lead-form' })}
                >
                  Solicitar acceso
                </a>
              </Button>
            </div>
          </div>
        </header>

        <section className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 shadow-sm shadow-slate-200/40 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:shadow-none">
                <SparkBadge />
                {activeHero.badge}
              </div>

              <div className="mt-8">
                <DashboardLogo
                  priority
                  size="lg"
                  iconClassName="h-16 w-16 sm:h-20 sm:w-20"
                  labelClassName="text-3xl sm:text-4xl"
                />
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
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
                      className={
                        isActive
                          ? 'rounded-full bg-brand-gradient px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_40px_rgba(236,72,153,0.25)]'
                          : 'rounded-full border border-slate-200/70 bg-white/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm shadow-slate-200/40 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:shadow-none dark:hover:bg-white/[0.08]'
                      }
                    >
                      {audienceHero[track.key].selector}
                    </button>
                  );
                })}
              </div>

              <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-5xl lg:text-7xl dark:text-white">
                {activeHero.title}
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-white/70">
                {activeHero.description}
              </p>

              <form
                id="lead-form"
                action={activeHero.formAction}
                method="get"
                onSubmit={() =>
                  trackMarketingEvent('landing_form_submit', {
                    cta: activeHero.formButton,
                    target: activeHero.formAction,
                  })
                }
                className="mt-10 max-w-xl rounded-[2rem] border border-slate-200/70 bg-white/82 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              >
                <input type="hidden" name="role" value={activeHero.formRole} />
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <Input
                    name="name"
                    placeholder="Tu nombre"
                    autoComplete="name"
                    className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
                  />
                  <Input
                    name="email"
                    type="email"
                    placeholder="Correo de trabajo"
                    autoComplete="email"
                    required
                    className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
                  />
                  <Button
                    type="submit"
                    className="h-12 rounded-2xl bg-brand-gradient px-6 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95 sm:h-14"
                  >
                    {activeHero.formButton}
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-white/62">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <CheckCircle2 className="h-4 w-4 text-pink-400" />
                    {activeHero.helperPrimary}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <Clock3 className="h-4 w-4 text-pink-400" />
                    {activeHero.helperSecondary}
                  </span>
                </div>

                {activeAudience === 'developers' && (
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <Link
                      href="/developers-portal"
                      onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Ir al portal de developers', target: '/developers-portal' })}
                      className="text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline dark:text-white/70 dark:hover:text-white"
                    >
                      Ir al portal de developers
                    </Link>
                    <Link
                      href="/api/docs/openapi.json"
                      onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Ver OpenAPI', target: '/api/docs/openapi.json' })}
                      className="text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline dark:text-white/70 dark:hover:text-white"
                    >
                      Ver OpenAPI
                    </Link>
                  </div>
                )}
              </form>

              <div className="mt-8 flex flex-wrap gap-3">
                {credibilityItems.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:shadow-none"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-1/3 h-44 w-44 rounded-full bg-[rgba(236,72,153,0.16)] blur-[110px]" />
              <div className="absolute right-0 top-10 h-36 w-36 rounded-full bg-[rgba(225,29,72,0.14)] blur-[100px]" />

              <div className="relative rounded-[2.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,248,0.96))] p-4 shadow-[0_35px_90px_rgba(236,72,153,0.14)] transition-colors duration-500 sm:p-6 dark:border-white/10 dark:bg-[#090909] dark:shadow-[0_35px_90px_rgba(0,0,0,0.55)]">
                <div className="rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.96))] p-4 transition-colors duration-500 sm:p-5 dark:border-white/[0.08] dark:bg-black/90">
                  <div className="flex items-center justify-between rounded-full border border-slate-200/80 bg-white/85 px-4 py-3 text-sm text-slate-500 shadow-sm shadow-slate-200/60 transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/65">
                    <div className="flex items-center gap-3">
                      <DashboardLogo size="sm" showLabel={false} iconClassName="h-8 w-8" />
                      <span className="font-semibold text-slate-900 dark:text-white/90">FondosEG</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-pink-50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-600 transition-colors duration-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                      <LockKeyhole className="h-3.5 w-3.5 text-pink-400" />
                      {activeAudience === 'developers' ? 'Portal tecnico' : 'Flujo seguro'}
                    </div>
                  </div>

                  <div className="relative mt-10 min-h-[530px] rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,250,0.92),rgba(248,250,252,0.96))] p-5 transition-colors duration-500 sm:min-h-[620px] dark:border-white/[0.06] dark:bg-[#060606]">
                    <div className="absolute left-4 top-14 hidden rounded-[1.5rem] border border-slate-200/80 bg-white/92 p-4 shadow-[0_24px_60px_rgba(148,163,184,0.22)] transition-colors duration-500 lg:block dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-2xl">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-white/[0.35]">{activeHero.topLabel}</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{activeHero.topValue}</p>
                      <p className="mt-1 text-sm text-emerald-400">{activeHero.topMeta}</p>
                    </div>

                    <div className="absolute bottom-10 right-0 hidden w-48 rounded-[1.5rem] border border-slate-200/80 bg-white/92 p-4 shadow-[0_24px_60px_rgba(148,163,184,0.22)] transition-colors duration-500 sm:block dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-2xl">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-white/[0.35]">{activeHero.sideLabel}</p>
                      <div className="mt-4 h-2 rounded-full bg-slate-200 dark:bg-white/10">
                        <div className="h-2 w-3/4 rounded-full bg-brand-gradient" />
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{activeHero.sideValue}</p>
                      <p className="text-sm text-slate-500 dark:text-white/[0.45]">{activeHero.sideMeta}</p>
                    </div>

                    <div className="absolute inset-x-0 top-12 mx-auto w-[280px] rounded-[2.25rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,248,0.94))] p-3 shadow-[0_28px_80px_rgba(236,72,153,0.16)] transition-colors duration-500 sm:w-[320px] dark:border-white/12 dark:bg-[#0d0d0d] dark:shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
                      <div className="rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-4 transition-colors duration-500 dark:border-white/[0.08] dark:bg-[#111111]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-white/[0.45]">{activeHero.welcomeEyebrow}</p>
                            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{activeHero.welcomeTitle}</h2>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5" />
                            <span className="h-8 w-8 rounded-full border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5" />
                          </div>
                        </div>

                        <div className="mt-5 rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-200/70 transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-white/[0.35]">{activeHero.mainLabel}</p>
                          <div className="mt-2 flex items-end justify-between gap-3">
                            <p className="text-3xl font-semibold text-slate-950 dark:text-white">{activeHero.mainValue}</p>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-500 dark:bg-white/[0.06] dark:text-emerald-400">{activeHero.mainBadge}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500 dark:text-white/[0.45]">{activeHero.mainDescription}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <div className="rounded-2xl bg-brand-gradient px-3 py-2 text-center text-xs font-semibold text-white">
                            {activeHero.tabs[0]}
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm shadow-slate-200/60 transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/75 dark:shadow-none">
                            {activeHero.tabs[1]}
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm shadow-slate-200/60 transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/75 dark:shadow-none">
                            {activeHero.tabs[2]}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {activeHero.grid.map(([label, value, meta]) => (
                            <div key={label} className="rounded-[1.25rem] border border-slate-200/80 bg-white/92 p-3 shadow-sm shadow-slate-200/70 transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-white/[0.35]">{label}</p>
                              <div className="mt-2 flex items-end justify-between gap-2">
                                <p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
                                <p className="text-xs text-slate-500 dark:text-white/[0.45]">{meta}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 rounded-[1.25rem] border border-slate-200/80 bg-white/92 p-4 shadow-sm shadow-slate-200/70 transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950 dark:text-white">{activeHero.priorityTitle}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-white/[0.45]">
                                {activeHero.priorityDescription}
                              </p>
                            </div>
                            {activeAudience === 'developers' ? (
                              <Code2 className="h-5 w-5 text-pink-400" />
                            ) : activeAudience === 'alliances' ? (
                              <Layers3 className="h-5 w-5 text-pink-400" />
                            ) : (
                              <BadgeCheck className="h-5 w-5 text-pink-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-8 left-6 right-6 flex items-center justify-between rounded-[1.4rem] border border-slate-200/80 bg-white/92 px-4 py-3 text-sm text-slate-500 shadow-[0_18px_40px_rgba(148,163,184,0.18)] transition-colors duration-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/55 dark:shadow-none">
                      <span>{activeHero.footer}</span>
                      {activeAudience === 'developers' ? (
                        <Webhook className="h-4 w-4 text-pink-400" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-pink-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="rounded-[2rem] border border-slate-200/70 bg-white/82 p-6 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,0.3)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_18px_40px_rgba(236,72,153,0.22)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/68">{description}</p>
              </Card>
            ))}
          </div>

          <div id="audiencias" className="mt-20 scroll-mt-28">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pink-300/80">Tres rutas, misma plataforma</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                Una landing, tres publicos y un mensaje claro para cada uno.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600 dark:text-white/65">
                En lugar de forzar un solo discurso, FondosEG presenta una entrada util para quien opera la red, para
                quien evalua una alianza y para quien necesita integrar la API.
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {audienceTracks.map((track) => {
                const isActive = track.key === activeAudience;

                return (
                  <Card
                    key={track.id}
                    className={isActive
                      ? 'rounded-[2rem] border border-pink-400/40 bg-white p-6 text-slate-950 shadow-[0_18px_50px_rgba(236,72,153,0.16)] dark:bg-white/[0.08] dark:text-white'
                      : 'rounded-[2rem] border border-slate-200/70 bg-white/82 p-6 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,0.3)]'}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pink-300/80">{track.eyebrow}</p>
                    <h3 className="mt-4 text-2xl font-semibold">{track.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/68">{track.description}</p>

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
                        className="h-12 rounded-2xl bg-brand-gradient px-5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95"
                      >
                        {track.ctaLabel}
                      </Button>
                      {track.isPortal && (
                        <Button
                          asChild
                          variant="outline"
                          className="h-12 rounded-2xl border-slate-200/70 bg-white/80 px-5 text-sm font-black uppercase tracking-[0.18em] text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
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

          <div id="beneficios" className="mt-20 grid gap-8 scroll-mt-28 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pink-300/80">Hecho para operacion real</p>
              <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                Lo que gana tu equipo cuando deja atras el control manual.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-white/65">
                La propuesta no se queda en funciones sueltas. Esta pensada para resolver tres dolores concretos de una
                operacion diaria: visibilidad, coordinacion y velocidad de respuesta.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'Sabras que saldo tiene cada gestor y que movimientos estan pendientes.',
                  'Podras responder al cliente sin abrir varias conversaciones o archivos.',
                  'Tendras historial, validacion y seguimiento en el mismo flujo.',
                  'Podras escalar la operacion con mas orden y menos dependencia de memoria humana.',
                ].map((item) => (
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
                  <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/62">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="accesos" className="mt-20 grid gap-6 scroll-mt-28 lg:grid-cols-2">
            <Card
              id="gestores-access"
              className="rounded-[2rem] border border-slate-200/70 bg-white/82 p-6 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,0.3)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pink-300/80">Acceso para operacion</p>
              <h3 className="mt-4 text-3xl font-semibold">Si eres gestor o agencia, entra por aqui.</h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-white/68">
                Crea tu acceso inicial y empieza a trabajar con saldo, trazabilidad y seguimiento desde un flujo mas
                ordenado.
              </p>

              <form
                action="/register"
                method="get"
                onSubmit={() => trackMarketingEvent('landing_form_submit', { cta: 'Crear acceso', target: '/register', section: 'gestores-access' })}
                className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input type="hidden" name="role" value="gestor" />
                <Input
                  name="name"
                  placeholder="Nombre del responsable"
                  autoComplete="name"
                  className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
                />
                <Input
                  name="email"
                  type="email"
                  placeholder="Correo de trabajo"
                  autoComplete="email"
                  required
                  className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
                />
                <Button
                  type="submit"
                  className="h-12 rounded-2xl bg-brand-gradient px-6 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95 sm:h-14"
                >
                  Crear acceso
                </Button>
              </form>
            </Card>

            <Card
              id="alliances-access"
              className="rounded-[2rem] border border-slate-200/70 bg-white/82 p-6 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,0.3)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pink-300/80">Acceso para alianzas</p>
              <h3 className="mt-4 text-3xl font-semibold">Si evaluas una alianza o inversion, empieza aqui.</h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-white/68">
                Deja tu correo para abrir una entrada inicial a la plataforma y revisar el negocio con mas contexto.
              </p>

              <form
                action="/register"
                method="get"
                onSubmit={() => trackMarketingEvent('landing_form_submit', { cta: 'Solicitar presentacion', target: '/register', section: 'alliances-access' })}
                className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input type="hidden" name="role" value="cliente" />
                <Input
                  name="name"
                  placeholder="Tu nombre"
                  autoComplete="name"
                  className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
                />
                <Input
                  name="email"
                  type="email"
                  placeholder="Correo corporativo"
                  autoComplete="email"
                  required
                  className="h-12 border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus-visible:border-pink-300 sm:h-14 dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/[0.35] dark:focus-visible:border-white/20"
                />
                <Button
                  type="submit"
                  className="h-12 rounded-2xl bg-brand-gradient px-6 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95 sm:h-14"
                >
                  Solicitar presentacion
                </Button>
              </form>
            </Card>
          </div>

          <div className="mt-20 rounded-[2.5rem] border border-slate-200/70 bg-white/82 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-8 lg:p-10 dark:border-white/10 dark:bg-white/5 dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pink-300/80">Urgencia operativa</p>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                  Cada jornada que sigues resolviendo a mano te cuesta tiempo, foco y margen de respuesta.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-white/65">
                  Si hoy tu operacion depende de chats, memoria y conciliaciones manuales, el mejor momento para
                  ordenar el proceso es antes del proximo pico de trabajo.
                </p>
              </div>

              <Button
                asChild
                className="h-14 rounded-2xl bg-brand-gradient px-8 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95"
              >
                <a
                  href="#lead-form"
                  onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Solicitar acceso', target: '#lead-form', section: 'urgency-footer' })}
                >
                  Solicitar acceso
                </a>
              </Button>
            </div>
          </div>

          <footer className="mt-10 rounded-[2.5rem] border border-slate-200/80 bg-white/86 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition-colors duration-500 sm:p-8 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_24px_80px_rgba(0,0,0,0.26)]">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <DashboardLogo size="md" labelClassName="text-2xl" />
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-white/68">
                  FondosEG organiza operacion, seguimiento y acceso tecnico en una sola plataforma para equipos que necesitan control real y capacidad de crecimiento.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="h-11 rounded-2xl bg-brand-gradient px-5 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_50px_rgba(236,72,153,0.28)] hover:opacity-95"
                  >
                    <a
                      href="#lead-form"
                      onClick={() => trackMarketingEvent('landing_cta_click', { cta: 'Footer solicitar acceso', target: '#lead-form' })}
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
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                    Navegacion
                  </p>
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

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                    Recursos
                  </p>
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
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:text-white/55">
              <span>FondosEG. Plataforma de operacion, control y acceso tecnico.</span>
              <span>Landing enfocada en gestores, aliados e integradores.</span>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function SparkBadge() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-white shadow-[0_10px_30px_rgba(236,72,153,0.25)]">
      <BadgeCheck className="h-3.5 w-3.5" />
    </span>
  );
}
