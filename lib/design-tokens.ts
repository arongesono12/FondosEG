/**
 * FondosEG Design Tokens
 *
 * Fuente única de verdad para todos los valores de diseño del proyecto.
 * Los CSS custom properties se generan a partir de estos tokens.
 *
 * Para usar en CSS: importar desde globals.css con @import
 * Para usar en JS/TS: importar directamente
 */

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  7: '1.75rem',   // 28px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  14: '3.5rem',   // 56px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;

export const radius = {
  none: '0',
  sm: '0.375rem',    // 6px
  md: '0.625rem',    // 10px
  lg: '0.875rem',    // 14px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px — --radius base
  '3xl': '2rem',     // 32px
  full: '9999px',
} as const;

export const colors = {
  brand: {
    primary: 'hsl(346 80% 55%)',
    'primary-strong': 'hsl(346 80% 48%)',
    'primary-foreground': 'hsl(0 0% 100%)',
  },
  surface: {
    light: {
      base: 'hsl(0 0% 100%)',
      '2': 'hsl(210 40% 98%)',
      fg: 'hsl(224 71.4% 4.1%)',
      border: 'hsl(215 25% 89%)',
      highlight: 'rgba(15, 23, 42, .06)',
      glow: 'rgba(236, 72, 153, .14)',
      shadow: '0 30px 80px -20px rgba(15, 23, 42, .28)',
    },
    dark: {
      base: 'hsl(217 60% 9%)',
      '2': 'hsl(222 60% 6%)',
      fg: 'hsl(210 20% 98%)',
      border: 'hsl(215 20% 40%)',
      highlight: 'rgba(255, 255, 255, .16)',
      glow: 'rgba(244, 114, 182, .14)',
      shadow: '0 30px 90px -20px rgba(0, 0, 0, .65)',
    },
  },
  background: {
    light: 'hsl(220 33% 98%)',
    dark: 'hsl(224 71% 4%)',
  },
  foreground: {
    light: 'hsl(224 71.4% 4.1%)',
    dark: 'hsl(210 20% 98%)',
  },
  muted: {
    light: 'hsl(220 14.3% 95.9%)',
    'light-fg': 'hsl(215 19% 35%)',
    dark: 'hsl(222.2 47.4% 11.2%)',
    'dark-fg': 'hsl(215 20% 65%)',
  },
  destructive: {
    light: 'hsl(0 84.2% 60.2%)',
    'light-fg': 'hsl(210 20% 98%)',
    dark: 'hsl(0 62.8% 30.6%)',
    'dark-fg': 'hsl(210 20% 98%)',
  },
  glass: {
    light: {
      border: 'rgba(2, 6, 23, 0.08)',
      glow: 'rgba(255, 255, 255, 0.75)',
      'overlay-top': 'rgba(255, 255, 255, 0.35)',
      'overlay-bottom': 'rgba(255, 255, 255, 0.10)',
      radial: 'rgba(255, 255, 255, 0.25)',
      'edge-strong': 'rgba(255, 255, 255, 0.65)',
      'edge-soft': 'rgba(255, 255, 255, 0.25)',
      shadow: '0 18px 60px rgba(2, 6, 23, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      'shadow-hover': '0 22px 80px rgba(2, 6, 23, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    },
    dark: {
      border: 'rgba(255, 255, 255, 0.10)',
      glow: 'rgba(255, 255, 255, 0.20)',
      'overlay-top': 'rgba(255, 255, 255, 0.08)',
      'overlay-bottom': 'rgba(255, 255, 255, 0.02)',
      radial: 'rgba(255, 255, 255, 0.10)',
      'edge-strong': 'rgba(255, 255, 255, 0.22)',
      'edge-soft': 'rgba(255, 255, 255, 0.08)',
      shadow: '0 22px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      'shadow-hover': '0 28px 95px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    },
  },
} as const;

export const fonts = {
  primary: '"Poppins", sans-serif',
  secondary: '"Roboto", sans-serif',
} as const;

export const typography = {
  'font-black': '700',
  'font-extrabold': '700',
  'font-bold': '600',
  'font-semibold': '500',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndex = {
  dropdown: 70,
  modal: 50,
  'modal-overlay': 40,
  'modal-close': 6,
  'mobile-bar': 60,
  header: 50,
} as const;
