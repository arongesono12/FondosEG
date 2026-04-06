'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { updatePasswordAction, updateProfileAction, uploadAvatarAction } from '@/app/actions/profile';
import { 
  User as UserIcon, 
  Phone, 
  Mail, 
  Shield, 
  Camera, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  CheckCircle2,
  Crop,
  Eye,
  EyeOff,
  LockKeyhole
} from 'lucide-react';
import { useEffect } from 'react';
import { getRoleLabel } from '@/lib/roles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/canvas-utils';
import { formatMonthYear } from '@/lib/utils';
import { validatePassword } from '@/lib/email-validation';

export default function ProfilePage() {
  const { user, setUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for cropping
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    const data = new FormData();
    data.append('name', formData.name);
    data.append('phone', formData.phone);
    data.append('userId', user.id);

    const result = await updateProfileAction(data);

    if (result.success) {
      setUser({ ...user, name: formData.name, phone: formData.phone });
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Error al actualizar el perfil' });
    }
    setLoading(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result as string);
      setIsCropping(true);
    });
    reader.readAsDataURL(file);
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropDone = async () => {
    if (!imageToCrop || !user) return;

    try {
      setUploading(true);
      setIsCropping(false);
      setMessage({ type: '', text: '' });

      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error('Error al procesar la imagen');

      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' });

      const data = new FormData();
      data.append('avatar', file);
      data.append('userId', user.id);
      if (user.avatar_url) {
        data.append('oldAvatarUrl', user.avatar_url);
      }

      const result = await uploadAvatarAction(data);

      if (result.success && result.avatarUrl) {
        setUser({ ...user, avatar_url: result.avatarUrl });
        setShowSuccessModal(true);
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al subir la imagen' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error al procesar la imagen' });
    } finally {
      setUploading(false);
      setImageToCrop(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const passwordValidation = validatePassword(passwordForm.newPassword);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    const data = new FormData();
    data.append('newPassword', passwordForm.newPassword);
    data.append('confirmPassword', passwordForm.confirmPassword);

    const result = await updatePasswordAction(data);

    if (result.success) {
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setPasswordMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
    } else {
      setPasswordMessage({ type: 'error', text: result.error || 'No se pudo actualizar la contraseña' });
    }

    setPasswordLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Ajustes de Perfil</h1>
        <p className="text-muted-foreground font-bold text-sm">Gestiona tu información personal y preferencias de cuenta.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Avatar Card */}
        <Card className="md:col-span-1 glass-premium bg-card/30 dark:bg-card/20 relative border-border/10 overflow-hidden shadow-2xl">

          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <Avatar className="h-32 w-32 border-4 border-white dark:border-slate-800 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="text-3xl font-black bg-brand-gradient text-white">
                  {user?.name ? getInitials(user.name) : 'SD'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                <Camera className="h-8 w-8 text-white" />
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
              onClick={(e) => (e.target as any).value = null}
            />
            <div className="mt-6 text-center space-y-2">
              <h3 className="text-xl font-black text-foreground">{user?.name}</h3>
              <Badge variant="outline" className="rounded-xl px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                {user?.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details Form */}
        <Card className="md:col-span-2 glass-premium bg-card/30 dark:bg-card/20 relative border-border/10 shadow-2xl">

          <CardHeader>
            <CardTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" /> Información Personal
            </CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-tight text-muted-foreground/60">
              Estos detalles serán visibles en las operaciones del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-1">Nombre Completo</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input 
                      id="name" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-11 h-12 rounded-xl focus:ring-2 focus:ring-primary/20 font-bold border-border/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-1">Teléfono Móvil</Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input 
                      id="phone" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-11 h-12 rounded-xl focus:ring-2 focus:ring-primary/20 font-bold border-border/20"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-1">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  <Input 
                    value={user?.email || ''} 
                    disabled 
                    className="pl-11 h-12 rounded-xl bg-muted/10 dark:bg-slate-900/20 border-dashed cursor-not-allowed font-bold opacity-60"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Cambios
              </Button>

              {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${
                  message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  <p className="text-sm font-bold">{message.text}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="glass-premium bg-card/30 dark:bg-card/20 relative border-border/10 overflow-hidden shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Seguridad y Estado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1 pt-4">
            <div className="p-4 rounded-2xl bg-muted/20 dark:bg-slate-900/40 border border-border/5 space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estado de Cuenta</p>
              <p className="text-sm font-black text-green-600 flex items-center gap-2 uppercase tracking-tighter">
                <CheckCircle className="h-4 w-4" /> Verificada
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/20 dark:bg-slate-900/40 border border-border/5 space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nivel de Acceso</p>
              <p className="text-sm font-black text-foreground uppercase tracking-tighter">
                {user?.role === 'superadmin' ? 'Nivel 4 (Super administrador)' : user?.role === 'admin' ? 'Nivel 3 (Administrador)' : user?.role === 'gestor' ? 'Nivel 2 (Gestor)' : `Nivel 1 (${getRoleLabel(user?.role)})`}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-muted/20 dark:bg-slate-900/40 border border-border/5 space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Miembro desde</p>
              <p className="text-sm font-black text-foreground uppercase tracking-tighter">
                {user?.created_at ? formatMonthYear(user.created_at) : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-premium bg-card/30 dark:bg-card/20 relative border-border/10 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" /> Cambiar Contraseña
            </CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-tight text-muted-foreground/60">
              Actualiza tu contraseña para reforzar la seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-1">Nueva contraseña</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))}
                    autoComplete="new-password"
                    className="pl-11 pr-12 h-12 rounded-xl focus:ring-2 focus:ring-primary/20 font-bold border-border/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-1">Confirmar contraseña</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))}
                    autoComplete="new-password"
                    className="pl-11 pr-12 h-12 rounded-xl focus:ring-2 focus:ring-primary/20 font-bold border-border/20"
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {passwordForm.newPassword && (
                <div className="rounded-2xl border border-border/10 bg-muted/20 p-4 space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Requisitos</p>
                  <div className="grid gap-1 text-xs font-bold text-muted-foreground">
                    <p className={passwordForm.newPassword.length >= 8 ? 'text-green-600' : ''}>Al menos 8 caracteres</p>
                    <p className={/[A-Z]/.test(passwordForm.newPassword) ? 'text-green-600' : ''}>Al menos una mayúscula</p>
                    <p className={/[0-9]/.test(passwordForm.newPassword) ? 'text-green-600' : ''}>Al menos un número</p>
                    <p className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordForm.newPassword) ? 'text-green-600' : ''}>Al menos un carácter especial</p>
                    {passwordForm.confirmPassword && (
                      <p className={passwordForm.newPassword === passwordForm.confirmPassword ? 'text-green-600' : 'text-rose-600'}>
                        La confirmación {passwordForm.newPassword === passwordForm.confirmPassword ? 'coincide' : 'no coincide'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={passwordLoading || !passwordValidation.valid || passwordForm.newPassword !== passwordForm.confirmPassword}
                className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Actualizar Contraseña
              </Button>

              {passwordMessage.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${
                  passwordMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {passwordMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  <p className="text-sm font-bold">{passwordMessage.text}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Cropping Dialog */}
      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden outline-none flex flex-col h-[80vh]">
          <DialogHeader className="p-6 border-b border-border/10">
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Crop className="h-5 w-5 text-primary" /> Ajustar Imagen
            </DialogTitle>
            <DialogDescription className="font-bold text-xs">
              Recorta tu foto para que se vea perfecta en tu perfil
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative flex-1 bg-slate-900 overflow-hidden">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>

          <div className="p-6 border-t border-border/10 bg-muted/20 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span>Zoom</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            
            <div className="flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => setIsCropping(false)}
                className="rounded-xl font-bold"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCropDone}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl font-black px-8"
              >
                Recortar y Subir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md text-center py-10 outline-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <DialogHeader className="flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 animate-in zoom-in duration-500">
              <CheckCircle2 className="h-16 w-16" />
            </div>
            <DialogTitle className="text-2xl font-bold dark:text-white">
              ¡Imagen Actualizada!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-lg">
              La imagen ha sido subida en el perfil correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full h-12 rounded-xl text-base font-semibold bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg transition-all"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
