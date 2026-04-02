'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getTransfers, getAllTransfers } from '@/services/transfer';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import type { Transfer } from '@/types';
import { Search, Download, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

export default function HistoryPage() {
  const { user } = useAppStore();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadTransfers() {
      try {
        if (user?.role === 'admin') {
          const data = await getAllTransfers(100);
          setTransfers(data);
        } else {
          const data = await getTransfers(100);
          setTransfers(data);
        }
      } catch (error) {
        console.error('Error loading transfers:', error);
      } finally {
        setLoading(false);
      }
    }
    if (user) loadTransfers();
  }, [user]);

  const filteredTransfers = transfers.filter((t) => 
    t.transfer_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sender_phone.includes(searchTerm) ||
    t.receiver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.receiver_phone.includes(searchTerm)
  );

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filteredTransfers.map((t) => ({
        Código: t.transfer_code,
        Remitente: t.sender_name,
        Teléfono_remitente: t.sender_phone,
        Destinatario: t.receiver_name,
        Teléfono_destinatario: t.receiver_phone,
        Destino: t.destination_city,
        Monto: t.amount,
        Moneda: t.currency,
        Estado: t.status,
        Fecha: formatDate(t.created_at),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transferencias');
    XLSX.writeFile(wb, `transferencias_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground font-semibold">Cargando historial...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Historial de Operaciones</h1>
          <p className="text-muted-foreground font-semibold text-sm">
            {user?.role === 'admin' ? 'Registro completo de todas las transacciones' : 'Listado detallado de tus transacciones'}
          </p>
        </div>
        <Button 
          onClick={exportToExcel} 
          className="bg-card/60 glass text-foreground border-border/10 hover:bg-primary hover:text-white rounded-2xl font-bold h-12 px-6 shadow-sm transition-all"
        >
          <Download className="h-5 w-5 mr-2" />
          Exportar a Excel
        </Button>
      </div>

      <Card className="glass-premium relative overflow-hidden border-border/10">
        <CardHeader className="border-b border-border/5 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5" /> Transacciones Recientes
            </CardTitle>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                placeholder="Buscar por código, nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-muted/40 border-border/20 rounded-2xl h-11 font-semibold focus:ring-primary/20"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/5 hover:bg-transparent">
                  <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider pl-8">Código</TableHead>
                  <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider">Remitente / Recibe</TableHead>
                  <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider">Destino</TableHead>
                  <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider text-right">Monto</TableHead>
                  <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider">Estado</TableHead>
                  <TableHead className="py-5 font-black text-muted-foreground text-xs uppercase tracking-wider pr-8">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-semibold">
                      No se encontraron transacciones en este periodo
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} className="border-border/5 hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-sm font-black text-foreground pl-8">{transfer.transfer_code}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> {transfer.sender_name}
                          </p>
                          <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {transfer.receiver_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-bold text-foreground">{transfer.destination_city}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">{transfer.destination_country || 'N/A'}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-black text-foreground text-base">
                          {formatCurrency(transfer.amount, transfer.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusColor(transfer.status)}`}>
                          {transfer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground pr-8">
                        {formatDate(transfer.created_at)}
                      </TableCell>
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
