import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, Code2,
  Cookie, FileCheck2, Gauge, Headphones, LayoutDashboard, LockKeyhole,
  Newspaper, ReceiptText, Scale, ShieldCheck, Sparkles, TestTube2,
  WalletCards,
} from 'lucide-react';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { legalDocuments } from '@/lib/legal-content';

const pages = {
  funciones: { eyebrow: 'Producto', title: 'Todo lo necesario para mover dinero con control', description: 'Centraliza transferencias, saldos, billeteras y seguimiento operativo en una plataforma pensada para equipos financieros.', icon: Sparkles, points: ['Transferencias y confirmaciones en tiempo real', 'Billeteras con saldos siempre visibles', 'Historial completo de cada operación'], cta: 'Crear una cuenta' },
  seguridad: { eyebrow: 'Seguridad', title: 'Protección en cada movimiento', description: 'FondosEG combina controles de acceso, trazabilidad y medidas preventivas para proteger usuarios, fondos y operaciones.', icon: ShieldCheck, points: ['Acceso protegido según el rol del usuario', 'Registro auditable de actividades sensibles', 'Monitoreo y prevención de operaciones anómalas'], cta: 'Conocer la plataforma' },
  precios: { eyebrow: 'Precios', title: 'Condiciones claras para una operación sostenible', description: 'La estructura comercial se adapta al volumen, los servicios utilizados y las necesidades operativas de cada organización.', icon: ReceiptText, points: ['Sin cargos ocultos', 'Propuesta ajustada al volumen operativo', 'Acompañamiento durante la implementación'], cta: 'Solicitar información' },
  novedades: { eyebrow: 'Novedades', title: 'El producto sigue avanzando', description: 'Consulta las mejoras recientes de la plataforma, nuevas integraciones y cambios que facilitan el trabajo diario.', icon: Newspaper, points: ['Mejoras continuas de rendimiento', 'Nuevas capacidades para gestores y aliados', 'Actualizaciones de API y seguridad'], cta: 'Explorar FondosEG' },
  dashboard: { eyebrow: 'Para gestores', title: 'El centro de control de toda tu operación', description: 'Consulta actividad, saldos, incidencias e indicadores desde una vista financiera y operativa unificada.', icon: LayoutDashboard, points: ['Resumen operativo en tiempo real', 'Indicadores clave de rendimiento', 'Acciones rápidas para el trabajo diario'], cta: 'Entrar al dashboard' },
  liquidaciones: { eyebrow: 'Para gestores', title: 'Liquidaciones claras y trazables', description: 'Da seguimiento al dinero pendiente, procesado y liquidado con contexto suficiente para conciliar cada movimiento.', icon: WalletCards, points: ['Estados claros por operación', 'Control de saldos y movimientos', 'Evidencias disponibles para conciliación'], cta: 'Comenzar ahora' },
  reportes: { eyebrow: 'Para gestores', title: 'Reportes que convierten actividad en decisiones', description: 'Analiza el rendimiento de la red y consulta la información necesaria para supervisar el negocio.', icon: BarChart3, points: ['Indicadores por periodo y operación', 'Información preparada para seguimiento', 'Visibilidad sobre volumen y rendimiento'], cta: 'Ver la plataforma' },
  soporte: { eyebrow: 'Ayuda', title: 'Acompañamiento cuando más lo necesitas', description: 'Nuestro equipo ayuda a resolver incidencias operativas, dudas de acceso e inquietudes sobre las integraciones.', icon: Headphones, points: ['Atención operativa todos los días', 'Seguimiento contextual de incidencias', 'Canal técnico para integraciones'], cta: 'Contactar con soporte' },
  'api-reference': { eyebrow: 'Developers', title: 'Una API diseñada para integraciones confiables', description: 'Consulta recursos, autenticación, respuestas y modelos para conectar tus sistemas con FondosEG.', icon: Code2, points: ['Endpoints documentados', 'Autenticación mediante credenciales seguras', 'Respuestas consistentes y trazables'], cta: 'Abrir documentación' },
  sandbox: { eyebrow: 'Developers', title: 'Prueba tu integración con seguridad', description: 'Valida flujos y respuestas en un entorno aislado antes de conectar tus operaciones reales.', icon: TestTube2, points: ['Credenciales separadas de producción', 'Datos de prueba controlados', 'Flujos preparados para validación técnica'], cta: 'Acceder al portal' },
  'estado-api': { eyebrow: 'Developers', title: 'Estado y disponibilidad de la API', description: 'Supervisa la salud de los servicios esenciales para anticipar y diagnosticar cualquier incidencia.', icon: Gauge, points: ['Disponibilidad de servicios principales', 'Seguimiento de incidencias activas', 'Información para equipos técnicos'], cta: 'Consultar la API' },
  terminos: { eyebrow: 'Legal', title: 'Términos y condiciones de uso', description: 'Estas condiciones establecen las reglas aplicables al acceso y utilización de los servicios de FondosEG.', icon: Scale, points: ['Uso responsable y autorizado de la plataforma', 'Responsabilidades asociadas a cada cuenta', 'Condiciones operativas y disponibilidad del servicio'], cta: 'Crear una cuenta' },
  privacidad: { eyebrow: 'Legal', title: 'Tu privacidad forma parte del producto', description: 'Tratamos los datos personales y operativos únicamente para prestar, proteger y mejorar los servicios de FondosEG.', icon: LockKeyhole, points: ['Tratamiento limitado a fines legítimos', 'Acceso restringido a personal autorizado', 'Protección de información personal y operativa'], cta: 'Contactar con soporte' },
  cumplimiento: { eyebrow: 'Legal', title: 'Cumplimiento incorporado a la operación', description: 'Aplicamos controles y procedimientos para favorecer operaciones transparentes, verificables y alineadas con la normativa aplicable.', icon: FileCheck2, points: ['Verificación y trazabilidad de operaciones', 'Controles internos basados en riesgo', 'Conservación de evidencias operativas'], cta: 'Conocer FondosEG' },
  cookies: { eyebrow: 'Legal', title: 'Uso transparente de cookies', description: 'Utilizamos tecnologías esenciales para mantener las sesiones seguras, recordar preferencias y comprender el funcionamiento del servicio.', icon: Cookie, points: ['Cookies necesarias para acceso y seguridad', 'Preferencias como el tema visual', 'Analítica limitada para mejorar la experiencia'], cta: 'Volver al inicio' },
} as const;

type PageSlug = keyof typeof pages;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const legalDocument = legalDocuments[slug as keyof typeof legalDocuments];
  if (legalDocument) return { title: `${legalDocument.title} | FondosEG`, description: legalDocument.summary };
  const page = pages[slug as PageSlug];
  return page ? { title: `${page.title} | FondosEG`, description: page.description } : {};
}

export default async function MarketingContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const legalDocument = legalDocuments[slug as keyof typeof legalDocuments];
  if (legalDocument) return <LegalPage document={legalDocument} />;
  const page = pages[slug as PageSlug];
  if (!page) notFound();
  const Icon = page.icon;
  const destination = slug === 'dashboard' ? '/login' : slug === 'api-reference' ? '/documentation' : slug === 'sandbox' || slug === 'estado-api' ? '/developers-portal' : slug === 'cookies' ? '/' : slug === 'soporte' || slug === 'privacidad' ? 'mailto:soporte@fondoseg.com' : '/register';

  return <main className="info-page">
    <header className="info-header"><Link href="/"><DashboardLogo size="md" labelClassName="text-xl" /></Link><div><ThemeToggle /><Link href="/" className="info-back"><ArrowLeft /> Volver al inicio</Link></div></header>
    <section className="info-hero"><div className="info-copy"><span><Icon /> {page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p><Link href={destination} className="btn-primary">{page.cta}<ArrowRight /></Link></div><article className="info-panel"><div className="info-panel-icon"><Icon /></div><h2>Lo más importante</h2>{page.points.map(point => <p key={point}><CheckCircle2 />{point}</p>)}</article></section>
    <section className="info-note"><BookOpen /><div><h2>Una experiencia conectada</h2><p>Esta página forma parte del ecosistema FondosEG. Desde aquí puedes continuar hacia el registro, la documentación técnica o volver al landing principal.</p></div></section>
  </main>;
}

function LegalPage({ document }: { document: (typeof legalDocuments)[keyof typeof legalDocuments] }) {
  return <main className="legal-page">
    <header className="info-header"><Link href="/"><DashboardLogo size="md" labelClassName="text-xl" /></Link><div><ThemeToggle /><Link href="/" className="info-back"><ArrowLeft /> Volver al inicio</Link></div></header>
    <section className="legal-hero"><span>{document.label}</span><h1>{document.title}</h1><p>{document.summary}</p><small>Vigente desde el {document.effectiveDate} · Versión 1.0</small></section>
    <div className="legal-layout">
      <aside><p>Contenido</p>{document.sections.map((section, index) => <a key={section.title} href={`#seccion-${index + 1}`}>{section.title}</a>)}</aside>
      <article className="legal-document">
        <div className="legal-notice"><ShieldCheck /><p>Este documento refleja las funciones identificadas en la aplicación FondosEG a la fecha de vigencia. Debe completarse con la identificación legal y licencias del operador antes de un lanzamiento comercial.</p></div>
        {document.sections.map((section, index) => <section id={`seccion-${index + 1}`} key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}
        <section className="legal-sources"><h2>Referencias regulatorias oficiales</h2><p>Marco consultado para la redacción. La aplicabilidad concreta debe confirmarse con asesoría jurídica local.</p><div><a href="https://www.beac.int/supervision-bancaire/reglements-de-cobac/" target="_blank" rel="noreferrer">Reglamentos COBAC — BEAC <ArrowRight /></a><a href="https://www.beac.int/systemes-paiement/instructions-circulaires-reglements/" target="_blank" rel="noreferrer">Sistemas de pago — BEAC <ArrowRight /></a><a href="https://www.beac.int/p-des-changes/reglements/" target="_blank" rel="noreferrer">Regulación de cambios — BEAC <ArrowRight /></a></div></section>
        <footer><p>¿Tienes dudas sobre este documento?</p><a href="mailto:soporte@fondoseg.com">soporte@fondoseg.com</a></footer>
      </article>
    </div>
  </main>;
}
