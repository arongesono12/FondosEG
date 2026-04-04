'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllTransfers, getTransfers } from '@/services/transfer';
import { formatCurrency, formatDate, getStatusColor, getStatusText } from '@/lib/utils';
import type { Transfer } from '@/types';
import { Download, History, Search, TrendingUp, Wallet, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

type StatusFilter = 'all' | 'completed' | 'created' | 'available_for_pickup' | 'cancelled';

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">{hint}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-white shadow-lg ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const { user } = useAppStore();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    async function loadTransfers() {
      try {
        const data = user?.role === 'admin' ? await getAllTransfers(150) : await getTransfers(150);
        setTransfers(data);
      } catch (error) {
        console.error('Error loading transfers:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadTransfers();
    }
  }, [user]);

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      !normalizedSearch ||
      transfer.transfer_code.toLowerCase().includes(normalizedSearch) ||
      transfer.sender_name.toLowerCase().includes(normalizedSearch) ||
      transfer.sender_phone.includes(normalizedSearch) ||
      transfer.receiver_name.toLowerCase().includes(normalizedSearch) ||
      transfer.receiver_phone.includes(normalizedSearch) ||
      transfer.destination_city.toLowerCase().includes(normalizedSearch);

    const matchesStatus = statusFilter === 'all' ? true : transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const completedTransfers = transfers.filter((transfer) => transfer.status === 'completed');
  const createdTransfers = transfers.filter((transfer) => transfer.status === 'created' || transfer.status === 'available_for_pickup');
  const cancelledTransfers = transfers.filter((transfer) => transfer.status === 'cancelled');
  const totalVolume = completedTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  const averageTicket = completedTransfers.length ? totalVolume / completedTransfers.length : 0;

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredTransfers.map((transfer) => ({
        Codigo: transfer.transfer_code,
        Remitente: transfer.sender_name,
        Telefono_remitente: transfer.sender_phone,
        Destinatario: transfer.receiver_name,
        Telefono_destinatario: transfer.receiver_phone,
        Destino: transfer.destination_city,
        Monto: transfer.amount,
        Moneda: transfer.currency,
        Estado: getStatusText(transfer.status),
        Fecha: formatDate(transfer.created_at),
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');
    XLSX.writeFile(workbook, `historial_transferencias_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-4xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-4xl border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
              Historial de operaciones
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Trazabilidad completa de transferencias</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
              {user?.role === 'admin'
                ? 'Consulta el registro consolidado de la red, filtra por estado y exporta la operación en formato de control.'
                : 'Revisa tu histórico de operaciones con búsqueda rápida, filtros por estado y exportación.'}
            </p>
          </div>

          <Button onClick={exportToExcel} className="rounded-2xl bg-brand-gradient px-6 font-black text-white shadow-xl shadow-pink-500/20">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Completadas" value={String(completedTransfers.length)} hint="Operaciones cerradas" icon={History} tone="border-emerald-500/20 bg-emerald-500 shadow-emerald-500/20" />
        <MetricTile label="Pendientes" value={String(createdTransfers.length)} hint="En seguimiento o pago" icon={Wallet} tone="border-amber-500/20 bg-amber-500 shadow-amber-500/20" />
        <MetricTile label="Canceladas" value={String(cancelledTransfers.length)} hint="Requieren auditoría si crecen" icon={XCircle} tone="border-rose-500/20 bg-rose-500 shadow-rose-500/20" />
        <MetricTile label="Ticket medio" value={formatCurrency(averageTicket)} hint={formatCurrency(totalVolume) + ' de volumen confirmado'} icon={TrendingUp} tone="border-sky-500/20 bg-sky-500 shadow-sky-500/20" />
      </section>

      <Card className="glass-premium overflow-hidden border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader className="border-b border-border/5 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-foreground">
              <History className="h-5 w-5 text-primary" />
              Registro operativo
            </CardTitle>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por código, nombre, teléfono o ciudad..."
                  className="h-11 rounded-2xl border-border/20 bg-background/70 pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'completed', label: 'Completadas' },
                  { id: 'created', label: 'Pendientes' },
                  { id: 'cancelled', label: 'Canceladas' },
                ].map((filter) => (
                  <Button
                    key={filter.id}
                    type="button"
                    variant={statusFilter === filter.id ? 'default' : 'outline'}
                    className="rounded-xl font-black"
                    onClick={() => setStatusFilter(filter.id as StatusFilter)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/5 hover:bg-transparent">
                  <TableHead className="pl-8 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Código</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Participantes</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Destino</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground text-right">Monto</TableHead>
                  <TableHead className="py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Estado</TableHead>
                  <TableHead className="pr-8 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-20 text-center text-sm font-bold text-muted-foreground">
                      No hay operaciones que coincidan con los filtros actuales.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="border-border/5 hover:bg-muted/30">
                      <TableCell className="pl-8">
                        <p className="font-mono text-sm font-black text-foreground">{transfer.transfer_code}</p>
                        {transfer.agent?.name && (
                          <p className="text-[10px] font-semibold uppercase text-primary">Gestor {transfer.agent.name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-foreground">{transfer.sender_name}</p>
                          <p className="text-xs font-semibold text-muted-foreground">{transfer.receiver_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-bold text-foreground">{transfer.destination_city}</p>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{transfer.destination_country || 'N/A'}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-sm font-black text-foreground">{formatCurrency(transfer.amount, transfer.currency)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusColor(transfer.status)}`}>
                          {getStatusText(transfer.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-xs font-semibold text-muted-foreground">{formatDate(transfer.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
