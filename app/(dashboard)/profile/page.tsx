'use client';

import { ChangeEvent, useEffect, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Camera, Clock, Image as ImageIcon, KeyRound, Mail, Phone, Shield, User as UserIcon } from 'lucide-react';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createCroppedAvatarBlob(
  imageSrc: string,
  options: { zoom: number; offsetX: number; offsetY: number; size?: number }
) {
  const image = await loadImage(imageSrc);
  const size = options.size ?? 512;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) return null;

  canvas.width = size;
  canvas.height = size;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);

  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * options.zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const maxOffsetX = Math.max((drawWidth - size) / 2, 0);
  const maxOffsetY = Math.max((drawHeight - size) / 2, 0);
  const x = (size - drawWidth) / 2 + (options.offsetX / 100) * maxOffsetX;
  const y = (size - drawHeight) / 2 + (options.offsetY / 100) * maxOffsetY;

  context.drawImage(image, x, y, drawWidth, drawHeight);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
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
  const [avatarDraftUrl, setAvatarDraftUrl] = useState('');
  const [avatarDraftName, setAvatarDraftName] = useState('');
  const [avatarZoom, setAvatarZoom] = useState(1.15);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [isSaving, startSavingTransition] = useTransition();
  const [isUploadingAvatar, startUploadTransition] = useTransition();
  const [isUpdatingPassword, startPasswordTransition] = useTransition();

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
  }, [user?.name, user?.phone]);

  useEffect(() => {
    return () => {
      if (avatarDraftUrl) URL.revokeObjectURL(avatarDraftUrl);
    };
  }, [avatarDraftUrl]);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    superadmin: 'Super Admin',
    gestor: 'Gestor de Fondos',
    cliente: 'Cliente',
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
    superadmin: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300',
    gestor: 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300',
    cliente: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300',
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
    event.target.value = '';

    if (!file.type.startsWith('image/')) {
      showFeedback('error', 'Selecciona una imagen válida.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showFeedback('error', 'La imagen no debe superar los 8 MB.');
      return;
    }

    if (avatarDraftUrl) URL.revokeObjectURL(avatarDraftUrl);
    setAvatarDraftUrl(URL.createObjectURL(file));
    setAvatarDraftName(file.name.replace(/\.[^.]+$/, '') || 'avatar');
    setAvatarZoom(1.15);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  };

  const closeAvatarCropper = () => {
    if (avatarDraftUrl) URL.revokeObjectURL(avatarDraftUrl);
    setAvatarDraftUrl('');
    setAvatarDraftName('');
    setAvatarZoom(1.15);
    setAvatarOffsetX(0);
    setAvatarOffsetY(0);
  };

  const handleAvatarCropUpload = () => {
    if (!user || !avatarDraftUrl) return;
    const formData = new FormData();
    formData.set('userId', user.id);
    formData.set('oldAvatarUrl', user.avatar_url || '');

    startUploadTransition(async () => {
      const croppedBlob = await createCroppedAvatarBlob(avatarDraftUrl, {
        zoom: avatarZoom,
        offsetX: avatarOffsetX,
        offsetY: avatarOffsetY,
      });

      if (!croppedBlob) {
        showFeedback('error', 'No se pudo recortar la imagen.');
        return;
      }

      const croppedFile = new File([croppedBlob], `${avatarDraftName}-avatar.jpg`, { type: 'image/jpeg' });
      formData.set('avatar', croppedFile);

      const result = await postProfileForm('/api/profile/avatar', formData, 'No se pudo actualizar el avatar.');
      if (!result.success || !result.avatarUrl) {
        showFeedback('error', result.error || 'No se pudo actualizar el avatar.');
        return;
      }

      setUser({
        ...user,
        avatar_url: result.avatarUrl,
      });
      showFeedback('success', 'Avatar actualizado correctamente.');
      closeAvatarCropper();
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
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-border/10 bg-card/80 text-card-foreground shadow-sm backdrop-blur-sm dark:bg-slate-950/70">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Información Personal</h2>
                <CardDescription>Datos básicos de tu cuenta</CardDescription>
              </div>
              <Badge className={roleColors[user.role] || 'bg-muted text-foreground ring-1 ring-border/20'}>
                {roleLabels[user.role] || user.role}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 border border-border/20">
                  <AvatarImage src={user.avatar_url} alt={user.name} />
                  <AvatarFallback className="bg-rose-500/10 text-rose-600 text-lg font-bold dark:text-rose-300">
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
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600 dark:text-rose-300" />
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="border-border/20 bg-background/80 pl-10 text-foreground placeholder:text-muted-foreground disabled:text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="profile-email">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600 dark:text-rose-300" />
                <Input
                  id="profile-email"
                  value={user.email}
                  className="border-border/20 bg-background/80 pl-10 text-foreground placeholder:text-muted-foreground disabled:text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider" htmlFor="profile-phone">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-600 dark:text-rose-300" />
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="border-border/20 bg-background/80 pl-10 text-foreground placeholder:text-muted-foreground disabled:text-muted-foreground"
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

        <Card className="border border-border/10 bg-card/80 text-card-foreground shadow-sm backdrop-blur-sm dark:bg-slate-950/70">
          <CardHeader>
            <h2 className="text-xl font-semibold text-foreground">Detalles de Cuenta</h2>
            <CardDescription>Seguridad y ubicación registrada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-300">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">ID de Usuario</p>
                <p className="rounded bg-rose-500/10 px-2 py-1 font-mono text-xs text-rose-700 selection:bg-rose-200 dark:text-rose-300 dark:selection:bg-rose-900">
                  {user.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-300">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Miembro desde</p>
                <p className="text-base font-semibold text-foreground">{formattedDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-300">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Última Conexión</p>
                <p className="text-base font-semibold text-foreground">Hace un momento</p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/20 bg-background/80 p-4 dark:bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-300">
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
                  className="border-border/20 bg-background/80 text-foreground placeholder:text-muted-foreground"
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
                  className="border-border/20 bg-background/80 text-foreground placeholder:text-muted-foreground"
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
      <Dialog open={Boolean(avatarDraftUrl)} onOpenChange={(open) => !open && !isUploadingAvatar && closeAvatarCropper()}>
        <DialogContent className="max-w-md rounded-3xl border-border/20 bg-background p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <ImageIcon className="h-5 w-5 text-primary" />
              Recortar foto de perfil
            </DialogTitle>
            <DialogDescription>
              Ajusta el encuadre antes de subir la imagen al almacenamiento de Supabase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="mx-auto h-64 w-64 overflow-hidden rounded-full border-4 border-primary/20 bg-muted shadow-inner">
              {avatarDraftUrl && (
                <img
                  src={avatarDraftUrl}
                  alt="Vista previa del avatar"
                  className="h-full w-full object-cover"
                  style={{
                    transform: `translate(${avatarOffsetX * 0.35}%, ${avatarOffsetY * 0.35}%) scale(${avatarZoom})`,
                    transformOrigin: 'center',
                  }}
                />
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-border/10 bg-card/70 p-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={avatarZoom}
                  onChange={(event) => setAvatarZoom(Number(event.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Posición horizontal
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={avatarOffsetX}
                  onChange={(event) => setAvatarOffsetX(Number(event.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Posición vertical
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={avatarOffsetY}
                  onChange={(event) => setAvatarOffsetY(Number(event.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={closeAvatarCropper} disabled={isUploadingAvatar}>
              Cancelar
            </Button>
            <Button type="button" className="rounded-xl bg-brand-gradient text-white" onClick={handleAvatarCropUpload} disabled={isUploadingAvatar}>
              {isUploadingAvatar ? 'Subiendo...' : 'Recortar y subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
