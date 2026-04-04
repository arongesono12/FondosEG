'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { signInAction } from '@/app/actions/auth';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signInAction(email, password);
    
    if (result.success) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  return (
    <div className="w-full relative group perspective-1000">
      {/* Ambient Glow */}
      <div className="absolute -inset-1 bg-brand-gradient rounded-[24px] blur-3xl opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-500" />
      
      <div className="relative bg-white/70 dark:bg-slate-950/50 border border-white/40 dark:border-white/10 shadow-2xl transition-all duration-500 rounded-[20px] backdrop-blur-2xl overflow-hidden text-card-foreground dark:text-white">
        <CardHeader className="space-y-2 text-center pb-4 md:pb-2">
          <div className="flex justify-center mb-2">
            <DashboardLogo
              size="lg"
              priority
              className="justify-center"
              labelClassName="text-3xl md:text-4xl"
            />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
            Inicia sesión
          </CardTitle>
          <CardDescription className="text-muted-foreground/80 dark:text-white/50 text-sm font-medium">
            Ingresa tus credenciales
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
              <Label htmlFor="email" className="text-sm font-semibold tracking-wide text-foreground/70 dark:text-white/60">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                className="bg-white/50 dark:bg-white/5 border border-border/50 dark:border-white/10 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/50 transition-all duration-300 h-12 px-4 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/40 shadow-inner"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold tracking-wide text-foreground/70 dark:text-white/60">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-white/50 dark:bg-white/5 border border-border/50 dark:border-white/10 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500/50 transition-all duration-300 h-12 px-4 pr-10 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/40 shadow-inner"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-white/50 hover:text-foreground dark:hover:text-white transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
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
              {loading ? 'Iniciando...' : 'Iniciar sesión'}
            </Button>
            <p className="text-sm text-center text-muted-foreground dark:text-white/60">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="font-medium bg-linear-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent hover:from-pink-600 hover:to-rose-700 dark:from-pink-400 dark:to-rose-400 transition-all">
                Regístrate
              </Link>
            </p>
          </CardFooter>
        </form>
      </div>
    </div>
  );
}
