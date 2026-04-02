import { redirect } from 'next/navigation';
import { ServiceUnavailableScreen } from '@/components/layout/service-unavailable-screen';
import { getOptionalAuthState } from '@/lib/server/authz';
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, serviceUnavailable } = await getOptionalAuthState();

  if (serviceUnavailable) {
    return <ServiceUnavailableScreen retryHref="/login" />;
  }

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background transition-colors duration-500">
      {/* Theme Toggle - Top Right on Desktop and Mobile */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Background decoration - Hidden on Mobile */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden hidden md:block">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-300/30 dark:bg-pink-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-400/20 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-200/20 dark:bg-pink-800/10 rounded-full blur-3xl pointer-events-none" />
      </div>
      
      {/* Mobile: Full width, Desktop: Max width card */}
      <div className="w-full md:max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}
