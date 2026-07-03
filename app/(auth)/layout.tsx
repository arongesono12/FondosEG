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
    <div className="auth-public-page min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
      {/* Theme Toggle - Top Right on Desktop and Mobile */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Mobile: Full width, Desktop: Max width card */}
      <div className="w-full md:max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </div>
    </div>
  );
}
