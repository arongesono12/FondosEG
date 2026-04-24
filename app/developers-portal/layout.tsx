import { ThemeToggle } from '@/components/theme-toggle';

export default function DevelopersPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-24 left-10 h-56 w-56 rounded-full bg-pink-400/10 blur-3xl" />
        <div className="absolute bottom-24 right-10 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
