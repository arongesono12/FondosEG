'use client';

import { ChangeEvent, useEffect, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConnectedApps } from '@/components/profile/connected-apps';
import { ProfileRecordPanel } from '@/components/profile/profile-record-panel';
import { getRoleLabel } from '@/lib/roles';
import { useAppStore } from '@/lib/store';

const ID_COPIED_RESET_MS = 2000;

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
  const { user, setUser } = useAppStore();
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const idCopiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  useEffect(() => () => clearTimeout(idCopiedTimer.current), []);

  const isBusy = isSaving || isUploadingAvatar || isUpdatingPassword;

  const formattedDate = user?.created_at
    ? format(new Date(user.created_at), "d 'de' MMMM, yyyy", { locale: es })
    : 'No disponible';

  const showFeedback = (tone: 'error' | 'success', message: string) => {
    setFeedbackTone(tone);
    setFeedback(message);
  };

  const handleProfileSave = async () => {
    if (!user || isBusy) return;
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
      setIsEditingPersonal(false);
    });
  };

  const startEditingPersonal = () => {
    setFeedback('');
    setIsEditingPersonal(true);
  };

  const cancelEditingPersonal = () => {
    if (isSaving) return;
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setFeedback('');
    setIsEditingPersonal(false);
  };

  const startEditingPassword = () => {
    setFeedback('');
    setIsEditingPassword(true);
  };

  const cancelEditingPassword = () => {
    if (isUpdatingPassword) return;
    setNewPassword('');
    setConfirmPassword('');
    setFeedback('');
    setIsEditingPassword(false);
  };

  const handleCopyId = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setIdCopied(true);
      clearTimeout(idCopiedTimer.current);
      idCopiedTimer.current = setTimeout(() => setIdCopied(false), ID_COPIED_RESET_MS);
    } catch {
      showFeedback('error', 'No se pudo copiar el ID. Selecciónalo y cópialo manualmente.');
    }
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!user || isUploadingAvatar) return;
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
    if (isBusy) return;
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
      setIsEditingPassword(false);
      showFeedback('success', 'Contraseña actualizada correctamente.');
    });
  };

  return (
    <div className="space-y-6">
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
          role={feedbackTone === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedbackTone === 'error'
              ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {feedback}
        </div>
      )}

      <ProfileRecordPanel
        user={user}
        roleLabel={getRoleLabel(user.role)}
        memberSince={formattedDate}
        personal={{
          editing: isEditingPersonal,
          saving: isSaving,
          name,
          phone,
          onNameChange: setName,
          onPhoneChange: setPhone,
          onEdit: startEditingPersonal,
          onCancel: cancelEditingPersonal,
          onSave: handleProfileSave,
        }}
        password={{
          editing: isEditingPassword,
          saving: isUpdatingPassword,
          newPassword,
          confirmPassword,
          onNewPasswordChange: setNewPassword,
          onConfirmPasswordChange: setConfirmPassword,
          onEdit: startEditingPassword,
          onCancel: cancelEditingPassword,
          onSave: handlePasswordSave,
        }}
        avatarUploading={isUploadingAvatar}
        onAvatarSelected={handleAvatarChange}
        idCopied={idCopied}
        onCopyId={handleCopyId}
      />

      {user.role === 'cliente' && <ConnectedApps />}
        </>
      )}
      <Dialog open={Boolean(avatarDraftUrl)} onOpenChange={(open) => !open && !isUploadingAvatar && closeAvatarCropper()}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Recortar foto de perfil
            </DialogTitle>
            <DialogDescription>
              Ajusta el encuadre antes de subir la imagen al almacenamiento de Supabase.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {/* El círculo de recorte no encoge con el cuerpo (que se desplaza),
                pero se acota también por el alto: en una ventana de 600px de
                alto el deslizador de zoom sigue a la vista bajo el círculo. */}
            <div className="mx-auto aspect-square w-[min(16rem,100%,40dvh)] overflow-hidden rounded-full border-4 border-primary/20 bg-muted shadow-inner">
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

            <div className="dashboard-inset space-y-4 rounded-2xl border border-border/10 bg-card p-4">
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
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={closeAvatarCropper} disabled={isUploadingAvatar}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" className="rounded-xl" onClick={handleAvatarCropUpload} disabled={isUploadingAvatar}>
              {isUploadingAvatar ? 'Subiendo...' : 'Recortar y subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
