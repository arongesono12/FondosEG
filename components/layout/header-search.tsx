'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, User, ArrowRight } from '@/components/ui/hugeicons';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { searchTransfers } from '@/modules/transfers/http/client';
import { formatCurrency } from '@/lib/utils';
import { Transfer } from '@/types';
import Link from 'next/link';
import { HttpError } from '@/services/http';

export function HeaderSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length <= 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchTransfers(q);
      setResults(data);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) {
        console.error('Search error:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const hasQuery = query.length > 2;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          inputMode="search"
          enterKeyHint="search"
          placeholder="Buscar..."
          className="pl-9 pr-3 h-9 w-48 lg:w-64 bg-muted/50 border-border/30 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 focus-visible:bg-background transition-all"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {/* La lista comparte capa con el resto de desplegables (ver tokens.css). */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 w-80 lg:w-96 rounded-2xl border border-border/10 bg-background shadow-xl shadow-black/8 z-(--z-popover) overflow-hidden">
          {!hasQuery ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Escribe al menos 3 caracteres</p>
              <p className="text-xs text-muted-foreground/60">Busca por código, nombre o ciudad</p>
            </div>
          ) : loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sin resultados</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href="/history"
                  onClick={() => { setOpen(false); setQuery(''); }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all border border-transparent hover:border-border/10 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary shrink-0">
                      <span className="font-black text-xs">SD</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-foreground uppercase truncate">{result.transfer_code}</p>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase shrink-0">
                          {result.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <User className="h-3 w-3 shrink-0" /> {result.receiver_name}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <MapPin className="h-3 w-3" /> {result.destination_city}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2 shrink-0 ml-2">
                    <p className="text-xs font-bold text-foreground">{formatCurrency(result.amount, result.currency)}</p>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="px-4 py-2.5 bg-muted/20 border-t border-border/5 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
            </p>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted-foreground/10">ESC</kbd> Cerrar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
