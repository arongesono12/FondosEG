'use client';

import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, Phone, Mail, Shield, Calendar, Clock } from 'lucide-react';
import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { useAppStore } from '@/lib/store';

export default function ProfilePage() {
  const { user } = useAppStore();

  if (!user) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <DashboardLogo className="h-8 w-auto animate-pulse" />
      </div>
    );
  }

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

  const formattedDate = user.created_at
    ? format(new Date(user.created_at), "d 'de' MMMM, yyyy", { locale: es })
    : 'No disponible';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Gestiona tu información personal y preferencias de cuenta.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Información Personal */}
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
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Nombre Completo</p>
                <p className="text-base font-semibold">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Correo Electrónico</p>
                <p className="text-base font-semibold">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Teléfono</p>
                <p className="text-base font-semibold">{user.phone || 'No registrado'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seguridad y Ubicación */}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
