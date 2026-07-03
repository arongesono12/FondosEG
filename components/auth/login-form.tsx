'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient, prepareForFreshSignIn } from '@/lib/supabase/client';

interface LoginFormProps {
  title?: string;
  description?: string;
  successRedirect?: string;
  registerHref?: string;
  registerLabel?: string;
  submitLabel?: string;
}

export function LoginForm({
  title = 'Inicia sesión',
  description = 'Ingresa tus credenciales',
  successRedirect = '/dashboard',
  registerHref = '/register',
  registerLabel = 'Regístrate',
  submitLabel = 'Iniciar sesión',
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getLoginErrorMessage = (message?: string) => {
    const normalizedMessage = message?.toLowerCase().trim() ?? '';

    if (normalizedMessage.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }

    if (normalizedMessage.includes('email not confirmed')) {
      return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
    }

    if (normalizedMessage.includes('too many requests')) {
      return 'Se han realizado demasiados intentos. Espera un momento e inténtalo de nuevo.';
    }

    return 'Error al iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      prepareForFreshSignIn();
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (!signInError && data.session) {
        router.push(successRedirect);
        router.refresh();
      } else {
        setError(getLoginErrorMessage(signInError?.message));
      }
    } catch {
      setError('No se pudo conectar con el servicio de autenticación. Verifica tu red e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full relative group perspective-1000">
      <div className="absolute -inset-1 bg-brand-gradient rounded-[24px] blur-3xl opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-500" />

      <div className="auth-contrast-card relative border shadow-2xl transition-all duration-500 rounded-[20px] overflow-hidden">
        <CardHeader className="space-y-2 text-center pb-4 md:pb-2">
          <div className="flex justify-center mb-2">
            <DashboardLogo
              size="lg"
              priority
              className="justify-center"
              labelClassName="text-4xl md:text-5xl"
            />
          </div>
          <CardTitle className="auth-card-title text-3xl font-bold tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="auth-card-muted text-sm font-medium">
            {description}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 md:space-y-5">
            {error && (
              <div className="p-3 md:p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="auth-card-label text-sm font-semibold tracking-wide">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                className="auth-card-input border focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/50 transition-all duration-300 h-12 px-4 rounded-xl shadow-inner"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="auth-card-label text-sm font-semibold tracking-wide">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="auth-card-input border focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/50 transition-all duration-300 h-12 px-4 pr-10 rounded-xl shadow-inner"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-card-eye absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full h-12 mt-2 rounded-2xl text-base font-bold uppercase tracking-widest bg-brand-gradient text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              disabled={loading}
            >
              {loading ? 'Iniciando...' : submitLabel}
            </Button>
            <p className="auth-card-muted text-sm text-center">
              ¿No tienes cuenta?{' '}
              <Link href={registerHref} className="font-medium bg-linear-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent hover:from-pink-600 hover:to-rose-700 dark:from-pink-400 dark:to-rose-400 transition-all">
                {registerLabel}
              </Link>
            </p>
          </CardFooter>
        </form>
      </div>
      <footer className="login-legal-footer">
        <p>© {new Date().getFullYear()} FondosEG. Todos los derechos reservados.</p>
        <nav aria-label="Enlaces legales del acceso">
          <Link href="/landing/terminos">Términos y condiciones</Link>
          <span aria-hidden="true">·</span>
          <Link href="/landing/privacidad">Privacidad</Link>
        </nav>
      </footer>
    </div>
  );
}
