'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, MapPin, User, ArrowRight } from '@/components/ui/hugeicons';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ModalListSkeleton } from '@/components/skeletons/app-skeletons';
import { searchTransfers } from '@/modules/transfers/http/client';
import { useAppStore } from '@/lib/store';
import { formatCurrency, getStatusText } from '@/lib/utils';
import { Transfer } from '@/types';
import Link from 'next/link';
import { HttpError } from '@/services/http';

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const { user } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // `autoFocus` no abre el teclado en Safari iOS: el campo queda con cursor
  // pero sin teclado y hay que tocarlo otra vez. Enfocar tras la animación de
  // apertura sí funciona en iOS y Android.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true);
        try {
          const data = await searchTransfers(query);
          setResults(data);
        } catch (error) {
          if (!(error instanceof HttpError && error.status === 401)) {
            console.error('Search error:', error);
          }
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="outline-none" aria-describedby={undefined}>
        {/* El campo de búsqueda vive en la cabecera fija: los resultados se
            desplazan en el cuerpo sin que el campo se vaya con ellos. */}
        <DialogHeader>
          <DialogTitle className="sr-only">Buscador Global</DialogTitle>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              inputMode="search"
              enterKeyHint="search"
              placeholder="Busca por código, nombre o ciudad..."
              className="pl-12 pr-12 h-14 bg-transparent border-none text-xl font-bold placeholder:text-muted-foreground/50 focus-visible:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading && (
              <Skeleton className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full" />
            )}
          </div>
        </DialogHeader>

        <DialogBody>
          {query.length <= 2 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Escribe al menos 3 caracteres</p>
              <p className="text-xs font-bold text-muted-foreground/60">Busca rápidamente cualquier movimiento en el sistema</p>
            </div>
          ) : loading ? (
            <ModalListSkeleton rows={4} />
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No se encontraron resultados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <Link 
                  key={result.id} 
                  href="/history" 
                  onClick={() => onOpenChange(false)}
                  // En columna hasta que el cuerpo del modal (no la ventana)
                  // mide 28rem: en un móvil la fila no cabía en horizontal.
                  className="flex flex-col gap-2 p-4 rounded-2xl hover:bg-muted/50 transition-all border border-transparent hover:border-border/10 group @md:flex-row @md:items-center @md:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                      <span className="font-black text-xs">SD</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-black text-foreground uppercase tracking-tighter">{result.transfer_code}</p>
                        <span className="shrink-0 text-xs font-black px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                          {getStatusText(result.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" /> <span className="truncate">{result.receiver_name}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{result.destination_city}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 @md:justify-end @md:text-right">
                    <div>
                      <p className="text-sm font-black text-foreground">{formatCurrency(result.amount, result.currency)}</p>
                      <p className="text-xs font-bold text-muted-foreground uppercase">Monto enviado</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DialogBody>

        {/* Barra de estado, no de acciones: se queda en fila también en móvil.
            El atajo ESC sólo se anuncia donde hay teclado físico probable. */}
        <DialogFooter className="flex-row items-center justify-between bg-muted/20">
          <p className="w-auto text-xs font-black text-muted-foreground uppercase tracking-widest">
            {results.length} resultados encontrados
          </p>
          <div className="hidden w-auto gap-4 [@media(hover:hover)]:flex">
            <span className="text-[11px] font-black text-muted-foreground uppercase flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted-foreground/10">ESC</kbd> Cerrar
            </span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
