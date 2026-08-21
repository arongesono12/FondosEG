import Link from 'next/link';

/** Pie legal compartido por las pantallas de acceso. */
export function AuthLegalFooter() {
  return (
    <footer className="login-legal-footer">
      <p>© {new Date().getFullYear()} FondosEG. Todos los derechos reservados.</p>
      <nav aria-label="Enlaces legales del acceso">
        <Link href="/landing/terminos">Términos y condiciones</Link>
        <span aria-hidden="true">·</span>
        <Link href="/landing/privacidad">Privacidad</Link>
      </nav>
    </footer>
  );
}
