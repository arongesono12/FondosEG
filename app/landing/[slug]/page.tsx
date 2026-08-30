import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, Code2,
  Gauge, Headphones, LayoutDashboard, LockKeyhole, Newspaper, ReceiptText, ShieldCheck,
  Sparkles, TestTube2, TrendingUp, WalletCards, Zap,
} from 'lucide-react';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FadeIn, FadeInRight, StaggerContainer, StaggerItem } from '@/components/marketing/motion-elements';
import { legalDocuments } from '@/lib/legal-content';
import { marketingPages, type MarketingPageSlug } from '@/lib/marketing-content';

const pageIcons = {
  'transferencias-instantaneas': Zap,
  'billetera-segura': LockKeyhole,
  'trazabilidad-completa': TrendingUp,
  'api-integraciones': Code2,
  funciones: Sparkles,
  seguridad: ShieldCheck,
  precios: ReceiptText,
  novedades: Newspaper,
  dashboard: LayoutDashboard,
  liquidaciones: WalletCards,
  reportes: BarChart3,
  soporte: Headphones,
  'api-reference': Code2,
  sandbox: TestTube2,
  'estado-api': Gauge,
} satisfies Record<MarketingPageSlug, typeof Sparkles>;

export function generateStaticParams() {
  return [...Object.keys(marketingPages), ...Object.keys(legalDocuments)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const legalDocument = legalDocuments[slug as keyof typeof legalDocuments];
  if (legalDocument) return { title: `${legalDocument.title} | FondosEG`, description: legalDocument.summary };
  const page = marketingPages[slug as MarketingPageSlug];
  return page ? { title: `${page.title} | FondosEG`, description: page.description } : {};
}

export default async function MarketingContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const legalDocument = legalDocuments[slug as keyof typeof legalDocuments];
  if (legalDocument) return <LegalPage document={legalDocument} />;

  const page = marketingPages[slug as MarketingPageSlug];
  if (!page) notFound();
  const Icon = pageIcons[slug as MarketingPageSlug];

  return <main className="info-page detailed-info-page">
    <PublicHeader />
    <section className="info-hero detailed-info-hero">
      <FadeIn><div className="info-copy">
        <span><Icon /> {page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
        <Button asChild variant="brand" size="xl" className="btn-primary"><Link href={page.destination}>{page.cta}<ArrowRight /></Link></Button>
      </div></FadeIn>
      <FadeInRight><Card asChild><article className="info-panel">
        <div className="info-panel-icon"><Icon /></div>
        <h2>Disponible actualmente</h2>
        {page.points.map((point) => <p key={point}><CheckCircle2 />{point}</p>)}
      </article></Card></FadeInRight>
    </section>

    <section className="info-capabilities">
      <FadeIn><div className="info-section-heading"><p>FUNCIONES VERIFICADAS</p><h2>Qué incluye esta sección</h2><span>Contenido construido a partir de rutas, componentes, servicios y migraciones presentes en FondosEG.</span></div></FadeIn>
      <StaggerContainer><div className="info-capability-grid">
        {page.sections.map((section, index) => <StaggerItem key={section.title}><Card asChild><article className="info-capability-card">
          <div className="info-card-number">{String(index + 1).padStart(2, '0')}</div>
          <h3>{section.title}</h3>
          <p>{section.description}</p>
          <ul>{section.items.map((item) => <li key={item}><CheckCircle2 />{item}</li>)}</ul>
        </article></Card></StaggerItem>)}
      </div></StaggerContainer>
    </section>

    <FadeIn><Card asChild interactive={false}><section className="info-note"><BookOpen /><div><h2>Alcance de esta página</h2><p>{page.note}</p></div></section></Card></FadeIn>
    <FadeIn><Card asChild interactive={false}><section className="info-final-cta"><div><p>FondosEG</p><h2>Continúa desde la función correspondiente</h2></div><Button asChild variant="brand" size="xl" className="btn-primary"><Link href={page.destination}>{page.cta}<ArrowRight /></Link></Button></section></Card></FadeIn>
  </main>;
}

function PublicHeader() {
  return <header className="info-header"><Link href="/"><DashboardLogo size="md" labelClassName="text-xl md:text-2xl" /></Link><div><ThemeToggle /><Button asChild variant="outline" size="lg" className="info-back"><Link href="/"><ArrowLeft /> Volver al inicio</Link></Button></div></header>;
}

function LegalPage({ document }: { document: (typeof legalDocuments)[keyof typeof legalDocuments] }) {
  return <main className="legal-page">
    <PublicHeader />
    <FadeIn><section className="legal-hero"><span>{document.label}</span><h1>{document.title}</h1><p>{document.summary}</p><small>Vigente desde el {document.effectiveDate} · Versión 1.0</small></section></FadeIn>
    <FadeIn><div className="legal-layout">
      <Card asChild interactive={false}><aside><p>Contenido</p>{document.sections.map((section, index) => <a key={section.title} href={`#seccion-${index + 1}`}>{section.title}</a>)}</aside></Card>
      <Card asChild interactive={false}><article className="legal-document">
        <Card asChild interactive={false}><div className="legal-notice"><ShieldCheck /><p>Este documento refleja las funciones identificadas en la aplicación FondosEG a la fecha de vigencia. Debe completarse con la identificación legal y licencias del operador antes de un lanzamiento comercial.</p></div></Card>
        {document.sections.map((section, index) => <FadeIn key={section.title}><section id={`seccion-${index + 1}`}><h2>{section.title}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section></FadeIn>)}
        <section className="legal-sources"><h2>Referencias regulatorias oficiales</h2><p>Marco consultado para la redacción. La aplicabilidad concreta debe confirmarse con asesoría jurídica local.</p><div><Card asChild><a href="https://www.beac.int/supervision-bancaire/reglements-de-cobac/" target="_blank" rel="noreferrer">Reglamentos COBAC — BEAC <ArrowRight /></a></Card><Card asChild><a href="https://www.beac.int/systemes-paiement/instructions-circulaires-reglements/" target="_blank" rel="noreferrer">Sistemas de pago — BEAC <ArrowRight /></a></Card><Card asChild><a href="https://www.beac.int/p-des-changes/reglements/" target="_blank" rel="noreferrer">Regulación de cambios — BEAC <ArrowRight /></a></Card></div></section>
        <footer><p>¿Tienes dudas sobre este documento?</p><a href="mailto:soporte@fondoseg.com">soporte@fondoseg.com</a></footer>
      </article></Card>
    </div></FadeIn>
  </main>;
}
