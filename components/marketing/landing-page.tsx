'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UserButton, useAuth } from '@clerk/nextjs';
import {
  ArrowRight, BadgeCheck, BarChart3, BookOpen, Check, ChevronDown,
  Code2, Eye, Facebook, Linkedin, LockKeyhole, Mail,
  Menu, Phone, ShieldCheck, TrendingUp, Twitter,
  Users, WalletCards, X, Youtube, Zap,
} from '@/components/ui/hugeicons';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import {
  FadeIn, FadeInDown, FadeInLeft, FadeInRight,
  StaggerContainer, StaggerItem,
} from '@/components/marketing/motion-elements';

export type LandingRole = 'gestores' | 'aliados' | 'developers';

const roleCopy = {
  gestores: { label: 'Gestores', title: 'Control total para quienes mueven el dinero', text: 'Administra operaciones, controla billeteras, comisiones y rendimiento de tu red en un solo lugar.', href: '/landing/gestores', icon: Users },
  aliados: { label: 'Aliados', title: 'Servicios financieros para ampliar tu alcance', text: 'Ofrece servicios financieros a tu red con herramientas simples, seguras y sin complicaciones.', href: '/landing/aliados', icon: WalletCards },
  developers: { label: 'Developers', title: 'La infraestructura para construir sin límites', text: 'Integra nuestras APIs y construye experiencias financieras rápidas, seguras y escalables.', href: '/landing/developers', icon: Code2 },
};

const tools = [
  { icon: Zap, title: 'Transferencias\ncon seguimiento', text: 'Crea y consulta transferencias desde un solo lugar, con estados y referencias para seguir cada operación.', tone: 'pink', href: '/landing/transferencias-instantaneas' },
  { icon: LockKeyhole, title: 'Billetera\nsegura', text: 'Consulta tu saldo y movimientos con acceso protegido según tu cuenta y tus permisos.', tone: 'blue', href: '/landing/billetera-segura' },
  { icon: TrendingUp, title: 'Trazabilidad\ncompleta', text: 'Visualiza cada movimiento, descarga reportes y da seguimiento operativo con total transparencia.', tone: 'green', href: '/landing/trazabilidad-completa' },
  { icon: Code2, title: 'API e\nintegraciones', text: 'Conecta FondosEG con tus sistemas para automatizar pagos, conciliaciones y flujos de trabajo.', tone: 'purple', href: '/landing/api-integraciones' },
];

const trust = [
  { icon: ShieldCheck, title: 'Controles de\ncumplimiento', text: 'Registra consentimientos y consulta las políticas aplicables a tus operaciones.' },
  { icon: LockKeyhole, title: 'Acceso\nprotegido', text: 'La autenticación y los permisos por rol ayudan a proteger los datos y las operaciones.' },
  { icon: BarChart3, title: 'Saldos y\nmovimientos', text: 'Consulta el saldo disponible y revisa los movimientos registrados en tu cuenta.' },
  { icon: Eye, title: 'Operación\ntransparente', text: 'Revisa comisiones, estados y reportes según los permisos de tu cuenta.' },
];

function Header() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const resourcesButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // El menú móvil se cierra con Escape y devuelve el foco al botón que lo abrió.
  useEffect(() => {
    if (!open && !resourcesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (open) {
        setOpen(false);
        menuButtonRef.current?.focus();
      } else {
        setResourcesOpen(false);
        resourcesButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, resourcesOpen]);
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
      {/* Mismas medidas que la marca del dashboard: el logotipo se ve igual
          en toda la aplicación. */}
      <Link href="/" aria-label="FondosEG inicio"><DashboardLogo size="md" priority labelClassName="text-xl md:text-2xl" /></Link>
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
          <button ref={resourcesButtonRef} type="button" aria-expanded={resourcesOpen} aria-controls={resourcesOpen ? 'landing-resources-menu' : undefined} onClick={() => setResourcesOpen(current => !current)}>Recursos <ChevronDown className={cn('size-3', resourcesOpen && 'rotate-180')} /></button>
          {resourcesOpen && <div id="landing-resources-menu" className="resources-menu"><Link href="/documentation" onClick={() => setResourcesOpen(false)}><BookOpen /> <span><strong>Documentación</strong><small>Guías, API y recursos técnicos</small></span><ArrowRight /></Link></div>}
        </div>
      </nav>
      <div className="landing-actions">
        <ThemeToggle />
        {/* Hasta que Clerk resuelve la sesión se muestran los enlaces públicos:
            evita un hueco durante la carga y no filtra estado de sesión. */}
        {isSignedIn ? (
          <>
            <Link className="btn-secondary" href="/dashboard">Ir al dashboard</Link>
            <UserButton />
          </>
        ) : (
          <>
            <Link className="btn-secondary" href="/login">Entrar</Link>
            <Link className="btn-primary" href="/register">Crear una cuenta <ArrowRight /></Link>
          </>
        )}
        <button ref={menuButtonRef} type="button" className="menu-button" onClick={() => setOpen(!open)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls={open ? 'landing-mobile-menu' : undefined}>{open ? <X /> : <Menu />}</button>
      </div>
    </div>
    {/* Cualquier enlace del menú lo cierra al navegar (delegación en el <nav>). */}
    {open && <nav id="landing-mobile-menu" aria-label="Menú principal" className="mobile-menu" onClick={(event) => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}><Link href="/landing/gestores">Gestores</Link><Link href="/landing/aliados">Aliados</Link><Link href="/landing/developers">Developers</Link><button type="button" aria-expanded={mobileResourcesOpen} aria-controls={mobileResourcesOpen ? 'landing-mobile-resources' : undefined} onClick={() => setMobileResourcesOpen(current => !current)}>Recursos <ChevronDown className={cn(mobileResourcesOpen && 'rotate-180')} /></button>{mobileResourcesOpen && <Link id="landing-mobile-resources" className="mobile-submenu-link" href="/documentation"><BookOpen /> Documentación</Link>}{isSignedIn ? <Link href="/dashboard">Ir al dashboard</Link> : <Link href="/login">Entrar</Link>}</nav>}
  </header>;
}

function Shell({ children }: { children: ReactNode }) { return <div className="landing-root"><a className="landing-skip-link" href="#landing-content">Saltar al contenido</a><Header /><main id="landing-content">{children}</main><Footer /></div>; }

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) { return <div className="section-heading"><p>{eyebrow}</p><h2>{children}</h2></div>; }

function Footer() { return <footer className="landing-footer"><div className="footer-grid">
  <div className="footer-brand"><DashboardLogo size="md" labelClassName="text-xl" /><p>Transferencias, saldos y seguimiento de operaciones en una sola plataforma.</p><div className="socials"><a href="https://facebook.com/fondoseg" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook /></a><a href="https://linkedin.com/company/fondoseg" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin /></a><a href="https://x.com/fondoseg" target="_blank" rel="noreferrer" aria-label="X / Twitter"><Twitter /></a><a href="https://youtube.com/@FondosEG" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube /></a></div></div>
  <FooterLinks title="Producto" links={[{label:'Funciones',href:'/landing/funciones'},{label:'Seguridad',href:'/landing/seguridad'},{label:'Precios',href:'/landing/precios'},{label:'Novedades',href:'/landing/novedades'}]} />
  <FooterLinks title="Para gestores" links={[{label:'Dashboard',href:'/landing/dashboard'},{label:'Liquidaciones',href:'/landing/liquidaciones'},{label:'Reportes',href:'/landing/reportes'},{label:'Soporte',href:'/landing/soporte'}]} />
  <FooterLinks title="Developers" links={[{label:'Documentación',href:'/documentation'},{label:'API Reference',href:'/landing/api-reference'},{label:'Sandbox',href:'/landing/sandbox'},{label:'Estado de API',href:'/landing/estado-api'}]} />
  <FooterLinks title="Legal" links={[{label:'Términos y condiciones',href:'/landing/terminos'},{label:'Política de privacidad',href:'/landing/privacidad'},{label:'Cumplimiento',href:'/landing/cumplimiento'},{label:'Cookies',href:'/landing/cookies'}]} />
  <div className="footer-help"><h4>¿Necesitas ayuda?</h4><a href="mailto:soporte@fondoseg.com"><Mail /> soporte@fondoseg.com</a><p><Phone /> +240 555 984 943</p></div>
  </div><p className="copyright">© {new Date().getFullYear()} FondosEG. Todos los derechos reservados.</p></footer>; }
function FooterLinks({ title, links }: { title: string; links: { label: string; href: string }[] }) { return <div><h4>{title}</h4>{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>; }

export function LandingPage() {
  return <Shell>
  <section className="hero-section">
    <div className="hero-glow" />
    <div className="hero-copy">
      <FadeInDown><span className="hero-pill"><Zap /> Tus operaciones en un solo lugar</span></FadeInDown>
      <FadeIn><h1>Mueve dinero con <span>velocidad, control</span> y confianza</h1></FadeIn>
      <FadeIn><p>FondosEG centraliza tus transferencias, saldos y movimientos para que puedas seguir tus operaciones desde un solo lugar.</p></FadeIn>
      <FadeIn><div className="hero-buttons"><Link className="btn-primary" href="/register">Crear una cuenta <ArrowRight /></Link><Link className="demo-button" href="/landing/funciones">Conocer funciones <ArrowRight /></Link></div></FadeIn>
      <FadeIn><div className="hero-checks"><span><Check /> Acceso web</span><span><Check /> Sin instalación</span><span><Check /> Seguimiento claro</span></div></FadeIn>
    </div>
    <FadeInRight><div className="hero-visual"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><Image src="/mockup.png" alt="Panel de FondosEG en ordenador, tableta y móvil" width={2048} height={1228} priority /></div></FadeInRight>
  </section>

  <section className="landing-section"><FadeIn><SectionTitle eyebrow="TODO LO QUE NECESITAS">Potentes herramientas para <span>mover tu negocio</span></SectionTitle></FadeIn><StaggerContainer><div className="feature-grid">{tools.map(({icon:Icon,...f})=><StaggerItem key={f.title}><article className="feature-card"><div className={`icon-box ${f.tone}`}><Icon /></div><h3>{f.title}</h3><p>{f.text}</p><Link className={f.tone} href={f.href} aria-label={`Más información sobre ${f.title.replace('\n', ' ')}`}>Saber más <ArrowRight /></Link></article></StaggerItem>)}</div></StaggerContainer></section>

  <section className="landing-section roles-section"><FadeIn><SectionTitle eyebrow="PARA CADA ROL, UNA EXPERIENCIA PENSADA PARA TI">Encuentra tu forma de operar</SectionTitle></FadeIn><StaggerContainer><div className="role-grid">{(Object.keys(roleCopy) as LandingRole[]).map((key,i)=>{const r=roleCopy[key];const Icon=r.icon;return <StaggerItem key={key} className="role-grid-item"><Link href={r.href} className={`role-card role-${i+1}`}><div className="role-card-content"><Icon/><h3>{r.label}</h3><p>{r.text}</p><strong>Conocer más <ArrowRight /></strong></div><div className="role-art" aria-hidden="true"><Icon/></div></Link></StaggerItem>})}</div></StaggerContainer></section>

  <section className="landing-section"><FadeIn><SectionTitle eyebrow="CONFIANZA EN CADA MOVIMIENTO">Infraestructura sólida para operaciones seguras</SectionTitle></FadeIn><StaggerContainer><div className="trust-grid">{trust.map(({icon:Icon,...x})=><StaggerItem key={x.title}><article className="trust-card"><div><Icon /></div><section><h3>{x.title}</h3><p>{x.text}</p></section></article></StaggerItem>)}</div></StaggerContainer></section>

  <FadeIn><section className="cta-section"><div><h2>Comienza con <span>FondosEG</span></h2><p>Crea tu cuenta y consulta las herramientas disponibles<br/>para gestionar tus operaciones con claridad.</p></div><div className="cta-actions"><Link className="btn-primary" href="/register">Crear una cuenta <ArrowRight /></Link><p><span><Check/> Acceso web</span><span><Check/> Sin instalación</span><span><Check/> Seguimiento de operaciones</span></p></div></section></FadeIn>
  </Shell>;
}

export function RoleLandingPage({ role }: { role: LandingRole }) { const r=roleCopy[role]; const Icon=r.icon; return <Shell><section className="role-detail"><FadeInLeft><div><span className="hero-pill"><Icon/> {r.label}</span><h1>{r.title}</h1><p>{r.text} FondosEG reúne control, seguridad y trazabilidad en una experiencia creada para tu equipo.</p><div className="hero-buttons"><Link className="btn-primary" href="/register">Crear una cuenta <ArrowRight/></Link><Link className="demo-button" href={role==='developers'?'/developers-portal':'/login'}>{role==='developers'?'Abrir portal':'Iniciar sesión'}</Link></div></div></FadeInLeft><FadeInRight><div className="role-detail-card"><Icon/><h2>{r.label}</h2>{['Seguimiento de operaciones','Acceso según tu rol','Soporte y trazabilidad'].map(x=><p key={x}><BadgeCheck/>{x}</p>)}</div></FadeInRight></section><section className="landing-section"><FadeIn><SectionTitle eyebrow="TODO EN UN SOLO LUGAR">La infraestructura para avanzar con confianza</SectionTitle></FadeIn><StaggerContainer><div className="feature-grid">{tools.map(({icon:I,...f})=><StaggerItem key={f.title}><article className="feature-card"><div className={`icon-box ${f.tone}`}><I/></div><h3>{f.title}</h3><p>{f.text}</p><Link href={f.href}>Saber más <ArrowRight /></Link></article></StaggerItem>)}</div></StaggerContainer></section></Shell>; }
