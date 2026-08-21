/**
 * Sistema visual de los componentes de Clerk.
 *
 * Todos los colores se expresan como `var(--auth-*)`, definidas en
 * `app/globals.css` para tema claro y oscuro. Clerk no conoce el tema de
 * `next-themes`, así que dejar que el CSS resuelva la variable es lo que hace
 * que la tarjeta siga al tema sin JavaScript ni parpadeo.
 *
 * La paleta es la de FondosEG (pink-500 -> rose-600), no la genérica que
 * propone el generador de diseño: la identidad de marca manda.
 */
export const clerkAppearance = {
  options: {
    // El logo se elimina del formulario: el encabezado "Entrar" sostiene la
    // jerarquía, y en /login ya hay marca en el resto de la pantalla.
    logoPlacement: 'none',
    socialButtonsPlacement: 'bottom',
  },

  variables: {
    colorPrimary: 'var(--auth-primary)',
    colorPrimaryForeground: '#ffffff',
    colorBackground: 'var(--auth-surface)',
    colorForeground: 'var(--auth-fg)',
    colorMuted: 'var(--auth-muted)',
    colorMutedForeground: 'var(--auth-muted-fg)',
    colorInput: 'var(--auth-input)',
    colorInputForeground: 'var(--auth-fg)',
    colorBorder: 'var(--auth-border)',
    colorRing: 'var(--auth-ring)',
    colorDanger: '#e11d48',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    // Hereda Poppins/Roboto ya cargadas por el layout: no añade otra fuente
    // de red sólo para la pantalla de acceso.
    fontFamily: 'inherit',
    fontFamilyButtons: 'inherit',
    borderRadius: '0.875rem',
    spacing: '1rem',
  },

  elements: {
    // Tarjeta principal: glassmorphism con profundidad por capas.
    cardBox: 'auth-card-premium',
    card: 'auth-card-inner',

    // "Entrar": con el logo fuera, este título pasa a ser el ancla visual.
    headerTitle: 'auth-title',
    headerSubtitle: 'auth-subtitle',

    // 48px de alto: por encima del mínimo de 44px para objetivos táctiles.
    formButtonPrimary: 'auth-submit',
    formFieldInput: 'auth-input',
    formFieldLabel: 'auth-label',

    socialButtonsBlockButton: 'auth-social',
    dividerRow: 'auth-divider',
    footerAction: 'auth-footer-action',
    footerActionLink: 'auth-footer-link',
  },
} as const;
