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
    <div className="w-full">
      <div className="bg-white/40 dark:bg-[#10121B]/40 border border-white/18 shadow-xl hover:shadow-2xl hover:border-white/30 dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all duration-500 rounded-[10px] backdrop-blur-[2px] overflow-hidden text-card-foreground dark:text-white">
        <CardHeader className="space-y-2 text-center pb-4 md:pb-2">
          <div className="flex justify-center mb-2">
            <DashboardLogo
              size="lg"
              priority
              className="justify-center"
              iconClassName="h-14 w-14 rounded-full"
              labelClassName="text-2xl md:text-3xl"
            />
          </div>
          <CardTitle className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">
            Inicia sesión
          </CardTitle>
          <CardDescription className="text-muted-foreground dark:text-white/60 text-sm">
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
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80 dark:text-white/80">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80 dark:text-white/80">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 pr-10 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50"
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
              className="w-full h-12 rounded-2xl text-base font-black uppercase tracking-widest bg-brand-gradient hover:opacity-90 text-white shadow-lg hover:shadow-primary/25 transition-all duration-300" 
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
