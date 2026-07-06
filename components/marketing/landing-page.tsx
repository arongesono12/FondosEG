'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight, BadgeCheck, BarChart3, BookOpen, Check, ChevronDown, CircleDollarSign,
  Clock3, Code2, Eye, Facebook, Headphones, Linkedin, LockKeyhole, Mail,
  Menu, Network, Phone, Play, Quote, ShieldCheck, TrendingUp, Twitter,
  Users, WalletCards, X, Youtube, Zap,
} from 'lucide-react';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type LandingRole = 'gestores' | 'aliados' | 'developers';

const roleCopy = {
  gestores: { label: 'Gestores', title: 'Control total para quienes mueven el dinero', text: 'Administra operaciones, controla billeteras, comisiones y rendimiento de tu red en un solo lugar.', href: '/landing/gestores', icon: Users },
  aliados: { label: 'Aliados', title: 'Servicios financieros para ampliar tu alcance', text: 'Ofrece servicios financieros a tu red con herramientas simples, seguras y sin complicaciones.', href: '/landing/aliados', icon: WalletCards },
  developers: { label: 'Developers', title: 'La infraestructura para construir sin límites', text: 'Integra nuestras APIs y construye experiencias financieras rápidas, seguras y escalables.', href: '/landing/developers', icon: Code2 },
};

const tools = [
  { icon: Zap, title: 'Transferencias\nal instante', text: 'Envía y recibe dinero en segundos. Sin intermediarios, con liquidación inmediata y notificaciones en tiempo real.', tone: 'pink', href: '/landing/transferencias-instantaneas' },
  { icon: LockKeyhole, title: 'Billetera\nsegura', text: 'Tus fondos protegidos con encriptación bancaria, controles de acceso y múltiples niveles de seguridad.', tone: 'blue', href: '/landing/billetera-segura' },
  { icon: TrendingUp, title: 'Trazabilidad\ncompleta', text: 'Visualiza cada movimiento, descarga reportes y da seguimiento operativo con total transparencia.', tone: 'green', href: '/landing/trazabilidad-completa' },
  { icon: Code2, title: 'API e\nintegraciones', text: 'Conecta FondosEG con tus sistemas para automatizar pagos, conciliaciones y flujos de trabajo.', tone: 'purple', href: '/landing/api-integraciones' },
];

const trust = [
  { icon: ShieldCheck, title: 'Cumplimiento\nnormativo', text: 'Cumplimos con estándares locales e internacionales para proteger tu operación y tu negocio.' },
  { icon: LockKeyhole, title: 'Seguridad\nde nivel bancario', text: 'Encriptación de extremo a extremo, monitoreo 24/7 y controles avanzados de prevención de fraudes.' },
  { icon: BarChart3, title: 'Saldos en\ntiempo real', text: 'Consulta tus saldos y movimientos al instante para tomar decisiones con total precisión.' },
  { icon: Eye, title: 'Operación\ntransparente', text: 'Comisiones claras, reportes detallados y total visibilidad de tu flujo de efectivo.' },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const closeResources = (event: MouseEvent) => {
      if (!resourcesRef.current?.contains(event.target as Node)) setResourcesOpen(false);
    };
    document.addEventListener('mousedown', closeResources);
    return () => document.removeEventListener('mousedown', closeResources);
  }, []);
  return <header className={cn('landing-header', scrolled && 'landing-header--scrolled')}>
    <div className="landing-nav">
      <Link href="/" aria-label="FondosEG inicio"><DashboardLogo size="md" priority labelClassName="text-xl" /></Link>
      <nav className="landing-navlinks">
        <Link href="/landing/gestores">Gestores</Link><Link href="/landing/aliados">Aliados</Link><Link href="/landing/developers">Developers</Link>
        <div
          className="resources-dropdown"
          ref={resourcesRef}
          onMouseEnter={() => setResourcesOpen(true)}
          onMouseLeave={() => setResourcesOpen(false)}
          onFocus={() => setResourcesOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setResourcesOpen(false);
          }}
        >
          <button type="button" aria-expanded={resourcesOpen ? 'true' : 'false'} aria-haspopup="menu" onClick={() => setResourcesOpen(current => !current)}>Recursos <ChevronDown className={cn('size-3', resourcesOpen && 'rotate-180')} /></button>
          {resourcesOpen && <div className="resources-menu" role="menu"><Link role="menuitem" href="/documentation" onClick={() => setResourcesOpen(false)}><BookOpen /> <span><strong>Documentación</strong><small>Guías, API y recursos técnicos</small></span><ArrowRight /></Link></div>}
        </div>
      </nav>
      <div className="landing-actions"><ThemeToggle /><Link className="btn-secondary" href="/login">Entrar</Link><Link className="btn-primary" href="/register">Comenzar gratis <ArrowRight /></Link>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menú">{open ? <X /> : <Menu />}</button>
      </div>
    </div>
    {open && <nav className="mobile-menu"><Link href="/landing/gestores">Gestores</Link><Link href="/landing/aliados">Aliados</Link><Link href="/landing/developers">Developers</Link><button type="button" onClick={() => setMobileResourcesOpen(current => !current)}>Recursos <ChevronDown className={cn(mobileResourcesOpen && 'rotate-180')} /></button>{mobileResourcesOpen && <Link className="mobile-submenu-link" href="/documentation"><BookOpen /> Documentación</Link>}<Link href="/login">Entrar</Link></nav>}
  </header>;
}

function Shell({ children }: { children: ReactNode }) { return <main className="landing-root"><Header />{children}<Footer /></main>; }

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) { return <div className="section-heading"><p>{eyebrow}</p><h2>{children}</h2></div>; }

function Footer() { return <footer className="landing-footer"><div className="footer-grid">
  <div className="footer-brand"><DashboardLogo size="md" labelClassName="text-xl" /><p>La plataforma financiera que conecta personas, empresas y oportunidades.<br />Sin intermediarios. Sin fronteras.</p><div className="socials"><a href="https://facebook.com/fondoseg" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook /></a><a href="https://linkedin.com/company/fondoseg" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin /></a><a href="https://x.com/fondoseg" target="_blank" rel="noreferrer" aria-label="X / Twitter"><Twitter /></a><a href="https://youtube.com/@FondosEG" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube /></a></div></div>
  <FooterLinks title="Producto" links={[{label:'Funciones',href:'/landing/funciones'},{label:'Seguridad',href:'/landing/seguridad'},{label:'Precios',href:'/landing/precios'},{label:'Novedades',href:'/landing/novedades'}]} />
  <FooterLinks title="Para gestores" links={[{label:'Dashboard',href:'/landing/dashboard'},{label:'Liquidaciones',href:'/landing/liquidaciones'},{label:'Reportes',href:'/landing/reportes'},{label:'Soporte',href:'/landing/soporte'}]} />
  <FooterLinks title="Developers" links={[{label:'Documentación',href:'/documentation'},{label:'API Reference',href:'/landing/api-reference'},{label:'Sandbox',href:'/landing/sandbox'},{label:'Estado de API',href:'/landing/estado-api'}]} />
  <FooterLinks title="Legal" links={[{label:'Términos y condiciones',href:'/landing/terminos'},{label:'Política de privacidad',href:'/landing/privacidad'},{label:'Cumplimiento',href:'/landing/cumplimiento'},{label:'Cookies',href:'/landing/cookies'}]} />
  <div className="footer-help"><h4>¿Necesitas ayuda?</h4><p><Mail /> soporte@fondoseg.com</p><p><Phone /> +240 555 984 943</p><p><Clock3 /> Lun–Dom 24/7</p></div>
  </div><p className="copyright">© {new Date().getFullYear()} FondosEG. Todos los derechos reservados.</p></footer>; }
function FooterLinks({ title, links }: { title: string; links: { label: string; href: string }[] }) { return <div><h4>{title}</h4>{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>; }

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  return <Shell>
  <section className="hero-section">
    <div className="hero-glow" />
    <div className="hero-copy">
      <span className="hero-pill"><Zap /> Conexión directa, sin intermediarios</span>
      <h1>Mueve dinero con <span>velocidad, control</span> y confianza</h1>
      <p>FondosEG centraliza tus operaciones de transferencia, controla tus billeteras, visualiza tu flujo de efectivo y da seguimiento operativo en tiempo real.</p>
      <div className="hero-buttons"><Link className="btn-primary" href="/register">Comenzar gratis <ArrowRight /></Link><button type="button" className="demo-button" onClick={() => setDemoOpen(true)}>Ver demo <Play /></button></div>
      <div className="hero-checks"><span><Check /> Sin tarjeta</span><span><Check /> Sin instalación</span><span><Check /> Listo en minutos</span></div>
    </div>
    <div className="hero-visual"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><Image src="/mockup.png" alt="Panel de FondosEG en ordenador, tableta y móvil" width={2048} height={1228} priority /></div>
  </section>

  <section className="stats-grid">
    <Stat icon={Network} value="250K+" label="Transacciones procesadas" tone="purple"/><Stat icon={CircleDollarSign} value="XAF 12.5M" label="Dinero movido por nuestros usuarios" tone="blue"/><Stat icon={ShieldCheck} value="99.9%" label="Seguimiento operativo en tiempo real" tone="green"/><Stat icon={Headphones} value="24/7" label="Soporte humano siempre disponible" tone="pink"/>
  </section>

  <section className="landing-section"><SectionTitle eyebrow="TODO LO QUE NECESITAS">Potentes herramientas para <span>mover tu negocio</span></SectionTitle><div className="feature-grid">{tools.map(({icon:Icon,...f})=><article className="feature-card" key={f.title}><div className={`icon-box ${f.tone}`}><Icon /></div><h3>{f.title}</h3><p>{f.text}</p><Link className={f.tone} href={f.href} aria-label={`Más información sobre ${f.title.replace('\n', ' ')}`}>Saber más <ArrowRight /></Link></article>)}</div></section>

  <section className="landing-section roles-section"><SectionTitle eyebrow="PARA CADA ROL, UNA EXPERIENCIA PENSADA PARA TI"><span className="sr-only">Experiencias por rol</span></SectionTitle><div className="role-grid">{(Object.keys(roleCopy) as LandingRole[]).map((key,i)=>{const r=roleCopy[key];const Icon=r.icon;return <Link href={r.href} className={`role-card role-${i+1}`} key={key}><Icon/><h3>{r.label}</h3><p>{r.text}</p><strong>{key==='gestores'?'Entrar como gestor':key==='aliados'?'Entrar como aliado':'Explorar para developers'} <ArrowRight /></strong><div className="role-art"><Icon/></div></Link>})}</div></section>

  <section className="landing-section"><SectionTitle eyebrow="CONFIANZA EN CADA MOVIMIENTO">Infraestructura sólida para operaciones seguras</SectionTitle><div className="trust-grid">{trust.map(({icon:Icon,...x})=><article className="trust-card" key={x.title}><div><Icon /></div><section><h3>{x.title}</h3><p>{x.text}</p></section></article>)}</div></section>

  <section className="landing-section"><SectionTitle eyebrow="LO QUE DICEN NUESTROS ALIADOS"><span className="sr-only">Testimonios</span></SectionTitle><div className="testimonial-grid"><Testimonial text="Con FondosEG optimizamos nuestros pagos y ahora tenemos visibilidad total de nuestras operaciones. La plataforma es rápida, estable y muy intuitiva." name="Mamadou Diallo" role="Director de Operaciones, LogiTrans SA"/><Testimonial text="La integración vía API nos permitió automatizar nuestros cobros y conciliaciones. El soporte técnico es excelente y siempre están disponibles." name="Aissatou Camara" role="CTO, PayLink Solutions" blue/></div><div className="dots"><i/><i/><i/><i/><i/></div></section>

  <section className="cta-section"><div><h2>Comienza con <span>FondosEG</span></h2><p>Crea tu cuenta gratis y comienza a mover tu dinero<br/>con velocidad, control y confianza.</p></div><form action="/register"><div><input type="email" name="email" placeholder="Correo electrónico" aria-label="Correo electrónico"/><button className="btn-primary">Comenzar gratis <ArrowRight /></button></div><p><span><Check/> Sin tarjeta de crédito</span><span><Check/> Configuración en minutos</span><span><Check/> Cancela cuando quieras</span></p></form></section>

  <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
    <DialogContent className="demo-dialog" aria-describedby="demo-description">
      <div className="demo-dialog-copy">
        <span>RECORRIDO DE LA PLATAFORMA</span>
        <DialogTitle>Descubre cómo funciona FondosEG</DialogTitle>
        <DialogDescription id="demo-description">Del acceso seguro al envío de dinero y el seguimiento desde el dashboard.</DialogDescription>
      </div>
      <div className="demo-player">
        {!videoUnavailable ? <video controls playsInline preload="metadata" poster="/mockup.png" onError={() => setVideoUnavailable(true)}>
          <source src="/fondoseg-demo.mp4" type="video/mp4" />
        </video> : <div className="demo-preview">
          <Image src="/mockup.png" alt="Vista previa del dashboard de FondosEG" width={2048} height={1228} />
          <div><Play /><strong>Demo en preparación</strong><p>El reproductor está listo para incorporar la grabación final de FondosEG.</p></div>
        </div>}
      </div>
      <div className="demo-chapters"><span><b>01</b> Inicio de sesión</span><span><b>02</b> Envío de dinero</span><span><b>03</b> Dashboard y seguimiento</span></div>
      <div className="demo-dialog-actions"><Link href="/login" className="demo-button" onClick={() => setDemoOpen(false)}>Explorar la aplicación</Link><Link href="/register" className="btn-primary" onClick={() => setDemoOpen(false)}>Crear cuenta <ArrowRight /></Link></div>
    </DialogContent>
  </Dialog>
  </Shell>;
}

function Stat({icon:Icon,value,label,tone}:{icon:typeof Zap;value:string;label:string;tone:string}) { return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon/></div><div><strong>{value}</strong><p>{label}</p></div></article>; }
function Testimonial({text,name,role,blue=false}:{text:string;name:string;role:string;blue?:boolean}) { return <article className="testimonial"><Quote className={blue?'blue':''}/><div><p>{text}</p><footer><span>{name.charAt(0)}</span><div><strong>{name}</strong><small>{role}</small></div></footer></div></article>; }

export function RoleLandingPage({ role }: { role: LandingRole }) { const r=roleCopy[role]; const Icon=r.icon; return <Shell><section className="role-detail"><div><span className="hero-pill"><Icon/> {r.label}</span><h1>{r.title}</h1><p>{r.text} FondosEG reúne control, seguridad y trazabilidad en una experiencia creada para tu equipo.</p><div className="hero-buttons"><Link className="btn-primary" href="/register">Comenzar ahora <ArrowRight/></Link><Link className="demo-button" href={role==='developers'?'/developers-portal':'/login'}>Ver plataforma</Link></div></div><div className="role-detail-card"><Icon/><h2>{r.label}</h2>{['Operaciones en tiempo real','Seguridad de nivel bancario','Soporte y trazabilidad completa'].map(x=><p key={x}><BadgeCheck/>{x}</p>)}</div></section><section className="landing-section"><SectionTitle eyebrow="TODO EN UN SOLO LUGAR">La infraestructura para avanzar con confianza</SectionTitle><div className="feature-grid">{tools.map(({icon:I,...f})=><article className="feature-card" key={f.title}><div className={`icon-box ${f.tone}`}><I/></div><h3>{f.title}</h3><p>{f.text}</p></article>)}</div></section></Shell>; }
