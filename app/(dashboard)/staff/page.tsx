'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { createAdminAccount, getStaffActivity, getStaffMembers, updateStaffStatus, type StaffActivityItem, type StaffMember } from '@/services/staff';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { getRoleLabel, isSuperAdminRole } from '@/lib/roles';
import { ShieldCheck, UserPlus, Activity, Power } from 'lucide-react';

export default function StaffPage() {
  const { user } = useAppStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activity, setActivity] = useState<StaffActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    country: '',
    city: '',
  });

  const loadData = async () => {
    try {
      const [staffData, activityData] = await Promise.all([getStaffMembers(), getStaffActivity()]);
      setStaff(staffData);
      setActivity(activityData);
    } catch (err) {
      console.error('Error loading staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isSuperAdminRole(user.role)) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user || !isSuperAdminRole(user.role)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Acceso denegado</h1>
        <p className="text-muted-foreground">Esta sección es exclusiva para el superadministrador.</p>
      </div>
    );
  }

  const activeAdmins = staff.filter((member) => member.role === 'admin' && member.is_active).length;
  const inactiveAdmins = staff.filter((member) => member.role === 'admin' && !member.is_active).length;

  const handleCreateAdmin = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await createAdminAccount(form);
      if (!result.success) {
        setError(result.error || 'No se pudo crear el administrador');
        return;
      }
      setForm({ name: '', email: '', phone: '', password: '', country: '', city: '' });
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error creating admin:', err);
      setError('No se pudo crear el administrador');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    try {
      const result = await updateStaffStatus(member.id, !member.is_active);
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Error updating staff status:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Control de administración</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Supervisa administradores, crea nuevas cuentas de staff y audita sus acciones sobre gestores y clientes.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl font-black">
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo administrador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear administrador</DialogTitle>
              <DialogDescription>
                La cuenta se creará ya verificada y podrá acceder al dashboard inmediatamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff_name">Nombre</Label>
                <Input id="staff_name" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff_email">Correo</Label>
                <Input id="staff_email" type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff_phone">Teléfono</Label>
                <Input id="staff_phone" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff_password">Contraseña temporal</Label>
                <Input id="staff_password" type="password" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff_country">País</Label>
                <Input id="staff_country" value={form.country} onChange={(e) => setForm((current) => ({ ...current, country: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff_city">Ciudad</Label>
                <Input id="staff_city" value={form.city} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl font-black" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-xl font-black" onClick={handleCreateAdmin} disabled={submitting}>
                {submitting ? 'Creando...' : 'Crear administrador'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{activeAdmins}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Power className="h-4 w-4" />
              Inactivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{inactiveAdmins}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Activity className="h-4 w-4" />
              Acciones recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{activity.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Equipo administrativo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getRoleLabel(member.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? 'default' : 'secondary'}>
                      {member.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{member.action_count} acciones</p>
                      <p className="text-xs text-muted-foreground">{member.last_action || 'Sin actividad'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(member.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {member.role === 'admin' ? (
                      <Button type="button" variant="outline" size="sm" className="rounded-xl font-black" onClick={() => handleToggleStatus(member)}>
                        {member.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">Protegido</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Bitácora del staff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay acciones registradas por administradores.</p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/10 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-foreground">{item.actor_name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {getRoleLabel(item.actor_role)} · {item.action}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">{formatDate(item.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
