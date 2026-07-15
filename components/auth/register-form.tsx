'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { REGISTER_COUNTRIES } from '@/lib/countries';
import { isValidEmailDomain, isValidEmailFormat, validatePassword } from '@/lib/email-validation';
import { getRoleLabel } from '@/lib/roles';
import type { UserRole } from '@/types';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface RegisterFormProps {
  title?: string;
  description?: string;
  successRedirect?: string;
  successTitle?: string;
  successDescription?: string;
  loginHref?: string;
  loginLabel?: string;
  submitLabel?: string;
  defaultRole?: UserRole;
  prefill?: {
    name?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
  };
}

export function RegisterForm({
  title = 'Crear cuenta',
  description = 'Únete a FondosEG y comienza a gestionar envíos',
  successRedirect = '/dashboard',
  successTitle = '¡Bienvenido a FondosEG!',
  successDescription = 'Tu cuenta ya está lista.',
  loginHref = '/login',
  loginLabel = 'Inicia sesión',
  submitLabel = 'Crear cuenta',
  defaultRole = 'gestor',
  prefill,
}: RegisterFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: prefill?.name ?? '',
    email: prefill?.email ?? '',
    phone: prefill?.phone ?? '',
    password: '',
    role: prefill?.role ?? defaultRole,
    document_type: 'dip',
    document_number: '',
    country: '',
    city: '',
  });
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredName, setRegisteredName] = useState('');
  const [registeredRole, setRegisteredRole] = useState<UserRole>(prefill?.role ?? defaultRole);

  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'email':
        if (!value) {
          setEmailError('');
          return;
        }
        if (!isValidEmailFormat(value)) {
          setEmailError('Formato de correo inválido');
          return;
        }
        const emailValidation = isValidEmailDomain(value);
        if (!emailValidation.valid) {
          setEmailError(emailValidation.message || 'Dominio de correo no permitido');
          return;
        }
        setEmailError('');
        return;
      case 'password':
        if (!value) {
          setPasswordError('');
          return;
        }
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.valid) {
          setPasswordError(passwordValidation.errors[0]);
          return;
        }
        setPasswordError('');
        return;
      default:
        return;
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    validateField(field, formData[field as keyof typeof formData] as string);
  };

  const isFieldValid = (field: string): boolean => {
    const value = formData[field as keyof typeof formData];
    switch (field) {
      case 'name':
        return String(value).trim().length >= 3;
      case 'email':
        return isValidEmailFormat(String(value)) && isValidEmailDomain(String(value)).valid;
      case 'phone':
        return String(value).length >= 8;
      case 'password':
        return validatePassword(String(value)).valid;
      case 'document_number':
        return String(value).trim().length >= 4;
      default:
        return false;
    }
  };

  const getFieldClass = (field: string, baseClass: string): string => {
    if (!touched[field]) return baseClass;

    const valid = isFieldValid(field);
    const hasError = field === 'email' ? emailError : field === 'password' ? passwordError : !valid;

    if (hasError) return `${baseClass} border-red-500 focus:ring-red-500/50`;
    if (valid) return `${baseClass} border-green-500 focus:ring-green-500/50`;
    return baseClass;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.country) {
      setError('Selecciona un país para continuar');
      return;
    }

    if (emailError || passwordError) {
      setError('Por favor, corrige los errores antes de continuar');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (result.success) {
        setRegisteredName(result.name || formData.name);
        setRegisteredRole((result.role as UserRole) || formData.role);
        const query = new URLSearchParams({
          userId: result.user?.id || '',
          email: result.email || formData.email,
          name: result.name || formData.name,
        });
        router.push(`/verify-email?${query.toString()}`);
      } else {
        setError(result.error || 'Error al registrar usuario');
      }
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-register-card border shadow-2xl transition-all duration-500 rounded-[20px] overflow-hidden">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <DashboardLogo
              size="lg"
              priority
              className="justify-center"
              labelClassName="text-3xl md:text-4xl"
            />
          </div>
          <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground dark:text-white/80">
            {description}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground/80 dark:text-white/80">Nombre completo</Label>
                <div className="relative">
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    className={getFieldClass('name', 'bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onBlur={() => handleBlur('name')}
                    required
                  />
                  {touched.name && isFieldValid('name') && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80 dark:text-white/80">Correo electrónico</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@gmail.com"
                    className={getFieldClass('email', 'bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50')}
                    value={formData.email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, email: value });
                      if (touched.email) validateField('email', value);
                    }}
                    onBlur={() => handleBlur('email')}
                    required
                  />
                  {touched.email && isFieldValid('email') && !emailError && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {touched.email && emailError && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                  )}
                </div>
                {touched.email && emailError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {emailError}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-foreground/80 dark:text-white/80">Teléfono</Label>
              <div className="relative">
                <PhoneInput
                  value={formData.phone}
                  onChange={(value) => setFormData({ ...formData, phone: value })}
                  placeholder="Número de teléfono"
                  required
                  className={`w-full ${touched.phone && isFieldValid('phone') ? '[&_input]:border-green-500' : ''}`}
                />
                {touched.phone && isFieldValid('phone') && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500 z-10" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80 dark:text-white/80">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 pr-16 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50 ${passwordError ? 'border-red-500 focus:ring-red-500/50' : ''}`}
                  value={formData.password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, password: value });
                    if (touched.password) validateField('password', value);
                  }}
                  onBlur={() => handleBlur('password')}
                  required
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {touched.password && isFieldValid('password') && !passwordError && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground dark:text-white/50 hover:text-foreground dark:hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {passwordError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {passwordError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-foreground/80 dark:text-white/80">Tipo de cuenta</Label>
              <Select value={formData.role} onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}>
                <SelectTrigger className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white">
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 text-foreground dark:text-white">
                  <SelectItem value="gestor">Gestor (Agente)</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document_type" className="text-foreground/80 dark:text-white/80">Tipo documento</Label>
                <Select value={formData.document_type} onValueChange={(value) => setFormData({ ...formData, document_type: value })}>
                  <SelectTrigger className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 text-foreground dark:text-white">
                    <SelectItem value="dip">DIP</SelectItem>
                    <SelectItem value="nie">NIE</SelectItem>
                    <SelectItem value="pasaporte">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_number" className="text-foreground/80 dark:text-white/80">Número</Label>
                <Input
                  id="document_number"
                  placeholder="12345678A"
                  className={getFieldClass('document_number', 'bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50')}
                  value={formData.document_number}
                  onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  onBlur={() => handleBlur('document_number')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-foreground/80 dark:text-white/80">País</Label>
                <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                  <SelectTrigger className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white">
                    <SelectValue placeholder="Selecciona un país" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 text-foreground dark:text-white">
                    {REGISTER_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-foreground/80 dark:text-white/80">Ciudad</Label>
                <Input
                  id="city"
                  placeholder="Su ciudad"
                  className="bg-white dark:bg-[#1a1a1a] border border-border/50 dark:border-white/10 focus:ring-2 focus:ring-pink-500/50 focus:border-primary/50 dark:focus:border-white/20 transition-all h-11 px-4 rounded-xl text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/50"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-6 pt-2">
            <Button type="submit" className="w-full h-12 rounded-2xl text-base font-semibold uppercase tracking-widest bg-brand-gradient hover:opacity-90 text-white shadow-lg hover:shadow-primary/25 transition-all duration-300" disabled={loading}>
              {loading ? 'Creando cuenta...' : submitLabel}
            </Button>
            <p className="text-sm text-center text-muted-foreground dark:text-white/60">
              ¿Ya tienes cuenta?{' '}
              <Link href={loginHref} className="font-medium bg-linear-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent hover:from-pink-600 hover:to-rose-700 dark:from-pink-400 dark:to-rose-400 transition-all">
                {loginLabel}
              </Link>
            </p>
          </CardFooter>
        </form>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md text-center py-10 outline-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <DialogHeader className="flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 animate-in zoom-in duration-500">
              <CheckCircle2 className="h-16 w-16" />
            </div>
            <DialogTitle className="text-2xl font-bold dark:text-white">
              {successTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-lg">
              {registeredName || 'Tu cuenta'} ya está lista. {successDescription} Entrarás como {getRoleLabel(registeredRole).toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Button
              onClick={() => router.push(successRedirect)}
              className="w-full h-12 rounded-xl text-base font-semibold bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg transition-all"
            >
              Ir al portal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
