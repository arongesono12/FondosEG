'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { isTransientNetworkMessage } from '@/lib/network-errors';
import {
  createAdminAccount,
  getManagedDashboardUsers,
  getManagedUserMovements,
  getStaffActivity,
  getStaffMembers,
  updateStaffStatus,
  type ManagedDashboardUser,
  type StaffActivityItem,
  type StaffMember,
  type UserMovementItem,
} from '@/services/staff';
import { HttpError } from '@/services/http';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency, formatDate, getStatusText } from '@/lib/utils';
import { getRoleLabel, isSuperAdminRole } from '@/lib/roles';
import {
  Activity,
  Download,
  Eye,
  Power,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

function movementKindTone(kind: UserMovementItem['kind']) {
  switch (kind) {
    case 'transfer':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'wallet_transfer':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'balance_transaction':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'support':
      return 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
  }
}

function getStaffLoadErrorMessage(error: unknown): string {
  if (error instanceof HttpError && error.message.trim()) {
    return error.message;
  }

  if (error instanceof Error) {
    if (
      isTransientNetworkMessage(error.message) ||
      error.message.toLowerCase().includes('failed to fetch')
    ) {
      return 'No pudimos conectar con el servidor. Recarga la página e inténtalo de nuevo.';
    }

    if (error.message.trim()) {
      return error.message;
    }
  }

  return 'No se pudo cargar la información del staff.';
}

function shouldReportStaffLoadError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status >= 500 && error.status !== 503;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return !(
    isTransientNetworkMessage(error.message) ||
    error.message.toLowerCase().includes('failed to fetch')
  );
}

export default function StaffPage() {
  const { user } = useAppStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activity, setActivity] = useState<StaffActivityItem[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedDashboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'gestor' | 'cliente'>('all');
  const [selectedUser, setSelectedUser] = useState<ManagedDashboardUser | null>(null);
  const [userMovements, setUserMovements] = useState<UserMovementItem[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementLimit, setMovementLimit] = useState(60);
  const [hasMoreMovements, setHasMoreMovements] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementKindFilter, setMovementKindFilter] = useState<'all' | UserMovementItem['kind']>('all');
  const [movementStatusFilter, setMovementStatusFilter] = useState<'all' | 'with_status' | 'without_status'>('all');
  const [movementDateFrom, setMovementDateFrom] = useState('');
  const [movementDateTo, setMovementDateTo] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    country: '',
    city: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const [staffResult, activityResult, managedUsersResult] = await Promise.allSettled([
      getStaffMembers(),
      getStaffActivity(),
      getManagedDashboardUsers(),
    ]);

    if (staffResult.status === 'fulfilled') {
      setStaff(staffResult.value);
    }

    if (activityResult.status === 'fulfilled') {
      setActivity(activityResult.value);
    }

    if (managedUsersResult.status === 'fulfilled') {
      setManagedUsers(managedUsersResult.value);
    }

    const failedResults = [staffResult, activityResult, managedUsersResult].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (failedResults.length > 0) {
      const firstError = failedResults[0].reason;
      const baseMessage = getStaffLoadErrorMessage(firstError);
      setLoadError(
        failedResults.length === 3
          ? baseMessage
          : `${baseMessage} Algunas secciones pueden mostrarse incompletas.`
      );

      failedResults.forEach((result) => {
        if (shouldReportStaffLoadError(result.reason)) {
          console.error('Unexpected error loading staff data:', result.reason);
        }
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && isSuperAdminRole(user.role)) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [loadData, user]);

  const activeAdmins = staff.filter((member) => member.role === 'admin' && member.is_active).length;
  const inactiveAdmins = staff.filter((member) => member.role === 'admin' && !member.is_active).length;
  const managedAgents = managedUsers.filter((member) => member.role === 'gestor').length;
  const managedClients = managedUsers.filter((member) => member.role === 'cliente').length;
  const managedActive = managedUsers.filter((member) => member.is_active).length;

  const filteredManagedUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase();

    return managedUsers.filter((member) => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      if (!matchesRole) return false;

      if (!normalizedSearch) return true;

      return [member.name, member.email, member.phone]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [managedUsers, roleFilter, userSearch]);

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
      setError(err instanceof Error ? err.message : 'No se pudo crear el administrador');
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

  const fetchUserMovements = async (
    member: ManagedDashboardUser,
    limit: number,
    options?: { resetFilters?: boolean }
  ) => {
    setSelectedUser(member);
    setUserMovements([]);
    setMovementsLoading(true);
    setMovementLimit(limit);

    if (options?.resetFilters) {
      setMovementSearch('');
      setMovementKindFilter('all');
      setMovementStatusFilter('all');
      setMovementDateFrom('');
      setMovementDateTo('');
    }

    try {
      const result = await getManagedUserMovements(member.id, limit);
      setSelectedUser(result.user);
      setUserMovements(result.movements);
      setHasMoreMovements(result.hasMore);
    } catch (err) {
      console.error('Error loading user movements:', err);
      setHasMoreMovements(false);
    } finally {
      setMovementsLoading(false);
    }
  };

  const openUserMovements = async (member: ManagedDashboardUser) => {
    await fetchUserMovements(member, 60, { resetFilters: true });
  };

  const loadMoreUserMovements = async () => {
    if (!selectedUser || movementsLoading || !hasMoreMovements) return;
    await fetchUserMovements(selectedUser, movementLimit + 60);
  };

  const filteredUserMovements = useMemo(() => {
    const normalizedSearch = movementSearch.trim().toLowerCase();

    return userMovements.filter((movement) => {
      const matchesKind = movementKindFilter === 'all' || movement.kind === movementKindFilter;
      if (!matchesKind) return false;

      const matchesStatus =
        movementStatusFilter === 'all' ||
        (movementStatusFilter === 'with_status' && Boolean(movement.status)) ||
        (movementStatusFilter === 'without_status' && !movement.status);
      if (!matchesStatus) return false;

      const movementDate = new Date(movement.created_at);
      if (movementDateFrom) {
        const fromDate = new Date(`${movementDateFrom}T00:00:00`);
        if (movementDate < fromDate) return false;
      }

      if (movementDateTo) {
        const toDate = new Date(`${movementDateTo}T23:59:59.999`);
        if (movementDate > toDate) return false;
      }

      if (!normalizedSearch) return true;

      return [movement.title, movement.description, movement.status, movement.currency]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [movementDateFrom, movementDateTo, movementKindFilter, movementSearch, movementStatusFilter, userMovements]);

  const exportFilteredMovementsToCsv = () => {
    if (!selectedUser || filteredUserMovements.length === 0 || typeof window === 'undefined') {
      return;
    }

    const escapeCsv = (value: unknown) => {
      const stringValue = String(value ?? '');
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['Fecha', 'Tipo', 'Titulo', 'Descripcion', 'Estado', 'Monto', 'Moneda', 'Referencia'],
      ...filteredUserMovements.map((movement) => [
        movement.created_at,
        movement.kind,
        movement.title,
        movement.description,
        movement.status || '',
        typeof movement.amount === 'number' ? movement.amount : '',
        movement.currency || '',
        movement.reference_id || '',
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `movimientos-${selectedUser.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!user || !isSuperAdminRole(user.role)) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Acceso denegado</h1>
        <p className="text-muted-foreground">Esta sección es exclusiva para el superadministrador.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
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
            Supervisa administradores y, además, consulta agentes y clientes para revisar los movimientos que generan dentro del dashboard.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setError('');
          }
        }}>
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

      {loadError && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-900 dark:text-amber-200">
          {loadError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Admins activos
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
              Admins inactivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{inactiveAdmins}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Gestores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{managedAgents}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Users className="h-4 w-4" />
              Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{managedClients}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Usuarios activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{managedActive}</p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Activity className="h-4 w-4" />
              Acciones staff
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
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Usuarios del dashboard</CardTitle>
            <p className="text-sm font-semibold text-muted-foreground">
              Consulta agentes y clientes, y abre su historial de movimientos recientes dentro del sistema.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre, email o teléfono"
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value: 'all' | 'gestor' | 'cliente') => setRoleFilter(value)}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="gestor">Gestores</SelectItem>
                <SelectItem value="cliente">Clientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último movimiento</TableHead>
                <TableHead>Movimientos</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredManagedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm font-semibold text-muted-foreground">
                    No hay usuarios que coincidan con el filtro actual.
                  </TableCell>
                </TableRow>
              ) : (
                filteredManagedUsers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-bold">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.phone}</p>
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
                      {member.last_movement_at ? (
                        <div>
                          <p className="font-semibold">{member.last_movement_label || 'Movimiento reciente'}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(member.last_movement_at)}</p>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">Sin movimientos registrados</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{member.movement_count}</p>
                    </TableCell>
                    <TableCell>{formatDate(member.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl font-black" onClick={() => openUserMovements(member)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver movimientos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
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

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Movimientos del usuario</DialogTitle>
            {selectedUser ? (
              <DialogDescription>
                {`${selectedUser.name} · ${getRoleLabel(selectedUser.role)} · ${selectedUser.email}`}
              </DialogDescription>
            ) : (
              <Skeleton className="h-4 w-72 rounded-xl" />
            )}
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Rol</p>
              <p className="mt-2 font-bold text-foreground">{selectedUser ? getRoleLabel(selectedUser.role) : '-'}</p>
            </div>
            <div className="rounded-2xl border border-border/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Estado</p>
              <p className="mt-2 font-bold text-foreground">{selectedUser?.is_active ? 'Activo' : 'Inactivo'}</p>
            </div>
            <div className="rounded-2xl border border-border/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Movimientos</p>
              <p className="mt-2 font-bold text-foreground">{selectedUser?.movement_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-border/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Último</p>
              <p className="mt-2 font-bold text-foreground">
                {selectedUser?.last_movement_at ? formatDate(selectedUser.last_movement_at) : 'Sin datos'}
              </p>
            </div>
          </div>

          <div className="mt-2 overflow-y-auto pr-1">
            <div className="mb-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  placeholder="Buscar en movimientos"
                  className="pl-9"
                />
              </div>
              <Select value={movementKindFilter} onValueChange={(value: 'all' | UserMovementItem['kind']) => setMovementKindFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="transfer">Transferencias</SelectItem>
                  <SelectItem value="wallet_transfer">Billetera</SelectItem>
                  <SelectItem value="balance_transaction">Saldo</SelectItem>
                  <SelectItem value="support">Soporte</SelectItem>
                  <SelectItem value="activity">Bitácora</SelectItem>
                </SelectContent>
              </Select>
              <Select value={movementStatusFilter} onValueChange={(value: 'all' | 'with_status' | 'without_status') => setMovementStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Con y sin estado</SelectItem>
                  <SelectItem value="with_status">Solo con estado</SelectItem>
                  <SelectItem value="without_status">Solo sin estado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={movementDateFrom}
                max={movementDateTo || undefined}
                onChange={(e) => setMovementDateFrom(e.target.value)}
              />
              <Input
                type="date"
                value={movementDateTo}
                min={movementDateFrom || undefined}
                onChange={(e) => setMovementDateTo(e.target.value)}
              />
            </div>

            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/10 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-foreground">
                  {filteredUserMovements.length} movimiento{filteredUserMovements.length !== 1 ? 's' : ''} visible{filteredUserMovements.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {movementDateFrom || movementDateTo
                    ? `Rango: ${movementDateFrom || 'inicio'} -> ${movementDateTo || 'hoy'}`
                    : 'Sin límite de fechas'}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl font-black"
                  onClick={exportFilteredMovementsToCsv}
                  disabled={filteredUserMovements.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>

            {movementsLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            ) : filteredUserMovements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/20 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-muted-foreground">
                  No hay movimientos que coincidan con los filtros actuales.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUserMovements.map((movement) => (
                  <div key={movement.id} className="rounded-2xl border border-border/10 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn('border-none', movementKindTone(movement.kind))}>
                            {movement.kind === 'transfer'
                              ? 'Transferencia'
                              : movement.kind === 'wallet_transfer'
                                ? 'Billetera'
                                : movement.kind === 'balance_transaction'
                                  ? 'Saldo'
                                  : movement.kind === 'support'
                                    ? 'Soporte'
                                    : 'Bitácora'}
                          </Badge>
                          {movement.status && (
                            <Badge variant="outline">{getStatusText(movement.status)}</Badge>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-foreground">{movement.title}</p>
                          <p className="text-sm font-medium text-muted-foreground">{movement.description}</p>
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        {typeof movement.amount === 'number' && (
                          <p className="text-base font-black text-foreground">
                            {formatCurrency(movement.amount, movement.currency || 'XAF')}
                          </p>
                        )}
                        <p className="text-xs font-semibold text-muted-foreground">{formatDate(movement.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMoreMovements && (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl font-black"
                      onClick={loadMoreUserMovements}
                      disabled={movementsLoading}
                    >
                      {movementsLoading ? 'Cargando...' : 'Cargar más'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl font-black" onClick={() => setSelectedUser(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
