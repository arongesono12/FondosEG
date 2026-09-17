import Link from 'next/link';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="auth-public-page relative flex min-h-dvh flex-col overflow-y-auto overscroll-y-contain p-4 transition-colors duration-500"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <header className="flex w-full shrink-0 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="FondosEG — ir al inicio"
          className="inline-flex min-h-11 items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <DashboardLogo size="sm" priority />
        </Link>

        <ThemeToggle />
      </header>

      <div className="flex w-full flex-1 flex-col items-center justify-start sm:justify-center">
        <div className="relative z-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 md:max-w-xl">
          {children}
        </div>
      </div>
    </div>
  );
}