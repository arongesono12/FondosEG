'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { sendVerificationEmail, verifyEmailCode, resendVerificationEmail } from '@/app/actions/auth';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const uid = searchParams.get('userId');
    const em = searchParams.get('email');
    const nm = searchParams.get('name');
    
    if (uid && em) {
      setUserId(uid);
      setEmail(em);
      setName(nm || 'Usuario');
      sendOTP();
    } else {
      setError('Parámetros de verificación inválidos');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const sendOTP = async () => {
    setLoading(true);
    setError('');
    
    const result = await sendVerificationEmail(userId, email, name);
    
    if (result.success) {
      setTimeLeft(result.expiresIn || 900);
    } else {
      setError(result.error || 'Error al enviar el código');
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }

    setVerifying(true);
    setError('');

    const result = await verifyEmailCode(userId, email, code);

    if (result.success) {
      setSuccess(true);
    } else {
      setAttempts(prev => prev + 1);
      setError(result.error || 'Código inválido');
      setCode('');
    }
    setVerifying(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setAttempts(0);

    const result = await resendVerificationEmail(userId, email, name);

    if (result.success) {
      setTimeLeft(result.expiresIn || 900);
      setCode('');
    } else {
      setError(result.error || 'Error al reenviar el código');
    }
    setResending(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (success) {
    return (
      <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-xl hover:shadow-primary/10 transition-all duration-300 rounded-3xl overflow-hidden ring-1 ring-border/5">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-1">
            <DashboardLogo
              size="md"
              className="justify-center"
              labelClassName="text-xl"
            />
          </div>
          <div className="flex justify-center mb-2">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black tracking-tighter text-green-600 dark:text-green-400">
            ¡Correo verificado!
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Tu correo electrónico ha sido verificado exitosamente
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col space-y-4 pt-2">
          <Button 
            onClick={() => router.push('/login')}
            className="w-full h-12 rounded-2xl text-base font-black uppercase tracking-widest bg-brand-gradient hover:opacity-90 text-white shadow-lg hover:shadow-primary/25 transition-all duration-300"
          >
            Ir al inicio de sesión
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Ya puedes iniciar sesión con tu cuenta
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-xl hover:shadow-primary/10 transition-all duration-300 rounded-3xl overflow-hidden ring-1 ring-border/5">
      <CardHeader className="space-y-2 text-center">
        <div className="flex justify-center mb-1">
          <DashboardLogo
            size="md"
            className="justify-center"
            labelClassName="text-xl"
          />
        </div>
        <div className="flex justify-center mb-2">
          <div className="p-3 rounded-2xl bg-linear-to-br from-pink-500 to-rose-600 text-white shadow-lg">
            <Mail className="h-8 w-8" />
          </div>
        </div>
        <CardTitle className="text-2xl font-black tracking-tighter text-foreground">
          Verifica tu correo
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Hemos enviado un código de 6 dígitos a<br />
          <span className="font-semibold text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleVerify}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code" className="text-muted-foreground">Código de verificación</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              className="h-14 text-center text-2xl font-bold tracking-[0.5em] border-border focus:ring-2 focus:ring-pink-500/50 focus:border-transparent transition-colors rounded-xl"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={loading || verifying}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            {timeLeft > 0 ? (
              <p className="text-muted-foreground">
                Expira en: <span className="font-semibold text-foreground">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <p className="text-red-500 font-medium">Código expirado</p>
            )}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || loading}
              className="text-primary hover:underline font-semibold disabled:opacity-50"
            >
              {resending ? 'Enviando...' : 'Reenviar código'}
            </button>
          </div>

          {attempts >= 3 && (
            <div className="p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
              Demasiados intentos fallidos. Usa el botón &quot;Reenviar código&quot; para obtener uno nuevo.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 pt-2">
          <Button 
            type="submit"
            className="w-full h-12 rounded-2xl text-base font-black uppercase tracking-widest bg-brand-gradient hover:opacity-90 text-white shadow-lg hover:shadow-primary/25 transition-all duration-300 disabled:opacity-50"
            disabled={loading || verifying || code.length !== 6}
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              'Verificar código'
            )}
          </Button>

          <Link 
            href="/register"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al registro
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-pink-50 via-white to-rose-50 dark:from-pink-950/20 dark:via-slate-950 dark:to-rose-950/20 flex items-center justify-center p-4">
      <Suspense fallback={
        <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-xl rounded-3xl p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </Card>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
