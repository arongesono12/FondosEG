'use client';

import { ChangeEvent, useEffect, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Camera, Clock, KeyRound, Mail, Phone, Shield, User as UserIcon } from 'lucide-react';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type ProfileApiResult = {
  success: boolean;
  error?: string;
  avatarUrl?: string;
};

async function postProfileForm(endpoint: string, formData: FormData, fallbackError: string): Promise<ProfileApiResult> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });
    const result = (await response.json()) as ProfileApiResult;

    if (!response.ok && result.success) {
      return { success: false, error: fallbackError };
    }

    return result;
  } catch {
    return { success: false, error: fallbackError };
  }
}

export default function ProfilePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, setUser } = useAppStore();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('success');
  const [isSaving, startSavingTransition] = useTransition();
  const [isUploadingAvatar, startUploadTransition] = useTransition();
  const [isUpdatingPassword, startPasswordTransition] = useTransition();

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.name, user?.phone]);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    superadmin: 'Super Admin',
    gestor: 'Gestor de Fondos',
    cliente: 'Cliente',
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-rose-100 text-rose-700',
    superadmin: 'bg-rose-100 text-rose-700',
    gestor: 'bg-blue-100 text-blue-700',
    cliente: 'bg-emerald-100 text-emerald-700',
  };

  const formattedDate = user?.created_at
    ? format(new Date(user.created_at), "d 'de' MMMM, yyyy", { locale: es })
    : 'No disponible';

  const showFeedback = (tone: 'error' | 'success', message: string) => {
    setFeedbackTone(tone);
    setFeedback(message);
  };

  const handleProfileSave = async () => {
    if (!user) return;
    setFeedback('');

    const formData = new FormData();
    formData.set('userId', user.id);
    formData.set('name', name);
    formData.set('phone', phone);

    startSavingTransition(async () => {
      const result = await postProfileForm('/api/profile/update', formData, 'No se pudo guardar el perfil.');
      if (!result.success) {
        showFeedback('error', result.error || 'No se pudo guardar el perfil.');
        return;
      }

      setUser({
        ...user,
        name: name.trim(),
        phone: phone.trim(),
      });
      showFeedback('success', 'Perfil actualizado correctamente.');
    });
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setFeedback('');

    const formData = new FormData();
    formData.set('avatar', file);
    formData.set('userId', user.id);
    formData.set('oldAvatarUrl', user.avatar_url || '');

    startUploadTransition(async () => {
      const result = await postProfileForm('/api/profile/avatar', formData, 'No se pudo actualizar el avatar.');
      if (!result.success || !result.avatarUrl) {
        showFeedback('error', result.error || 'No se pudo actualizar el avatar.');
        event.target.value = '';
        return;
      }

      setUser({
        ...user,
        avatar_url: result.avatarUrl,
      });
      showFeedback('success', 'Avatar actualizado correctamente.');
      event.target.value = '';
    });
  };

  const handlePasswordSave = async () => {
    setFeedback('');

    const formData = new FormData();
    formData.set('newPassword', newPassword);
    formData.set('confirmPassword', confirmPassword);

    startPasswordTransition(async () => {
      const result = await postProfileForm('/api/profile/password', formData, 'No se pudo actualizar la contraseña.');
      if (!result.success) {
        showFeedback('error', result.error || 'No se pudo actualizar la contraseña.');
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      showFeedback('success', 'Contraseña actualizada correctamente.');
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {!user ? (
        <div className="flex h-[400px] items-center justify-center">
          <DashboardLogo className="h-8 w-auto animate-pulse" />
        </div>
      ) : (
        <>
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Gestiona tu información personal y preferencias de cuenta.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedbackTone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Información Personal</h2>
                <CardDescription>Datos básicos de tu cuenta</CardDescription>
              </div>
              <Badge className={roleColors[user.role] || 'bg-gray-100'}>
                {roleLabels[user.role] || user.role}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 border border-border/20">
                  <AvatarImage src={user.avatar_url} alt={user.name} />
                  <AvatarFallback className="bg-rose-50 text-rose-600 text-lg font-bold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-700"
                  aria-label="Cambiar avatar"
                  disabled={isUploadingAvatar}
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Foto de perfil</p>
                <p className="text-sm text-muted-foreground">
                  {isUploadingAvatar ? 'Subiendo avatar...' : 'Haz clic en la cámara para cambiar tu foto.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="profile-name">
                Nombre Completo
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600" />
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="profile-email">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600" />
                <Input
                  id="profile-email"
                  value={user.email}
                  className="pl-10"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="profile-phone">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600" />
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={handleProfileSave}
              disabled={isSaving || isUploadingAvatar}
              className="w-full"
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold">Detalles de Cuenta</h2>
            <CardDescription>Seguridad y ubicación registrada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">ID de Usuario</p>
                <p className="text-xs font-mono bg-rose-50 px-2 py-1 rounded text-rose-700 selection:bg-rose-200">
                  {user.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Miembro desde</p>
                <p className="text-base font-semibold">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Última Conexión</p>
                <p className="text-base font-semibold">Hace un momento</p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Contraseña</p>
                  <p className="text-sm text-muted-foreground">Actualiza tu contraseña desde tu perfil.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="new-password">
                  Nueva contraseña
                </label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="confirm-password">
                  Confirmar contraseña
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              <Button
                type="button"
                onClick={handlePasswordSave}
                disabled={isUpdatingPassword || isSaving || isUploadingAvatar}
                className="w-full"
              >
                {isUpdatingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
