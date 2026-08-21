import { ThemeToggle } from '@/components/theme-toggle';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="auth-public-page relative flex min-h-dvh flex-col items-center justify-start overflow-y-auto overscroll-y-contain p-4 transition-colors duration-500 sm:justify-center"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        className="absolute z-50"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 md:max-w-xl">
        {children}
      </div>
    </div>
  );
}
