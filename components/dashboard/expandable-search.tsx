'use client';

import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Search, X } from '@/components/ui/hugeicons';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Nombre accesible del botón y del campo. */
  label: string;
  placeholder: string;
}

/**
 * Buscador reducido a un icono, que se abre de derecha a izquierda desde su lado derecho.
 * Con texto sigue abierto: un filtro activo nunca queda oculto.
 */
export function ExpandableSearch({ value, onChange, label, placeholder }: ExpandableSearchProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = open || value.length > 0;

  const expand = () => {
    flushSync(() => setOpen(true));
    inputRef.current?.focus();
  };

  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    flushSync(() => {
      onChange('');
      setOpen(false);
    });
    triggerRef.current?.focus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!value && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <div
      onBlur={handleBlur}
      className={cn(
        'relative ml-auto h-10 max-w-full min-w-0 shrink transition-[width] duration-200 ease-out motion-reduce:transition-none pointer-coarse:h-11',
        expanded ? 'w-84 @max-xl:w-full' : 'w-10 shrink-0 pointer-coarse:w-11',
      )}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        aria-expanded={expanded}
        onClick={expand}
        className={cn('absolute inset-0 h-full w-full bg-background/70', expanded && 'invisible')}
      >
        <Search />
      </Button>
      {/* Cerrado, el campo mide más que el icono: sin recorte sobresaldría de la tarjeta. */}
      <div className={cn('absolute inset-0', !expanded && 'invisible overflow-hidden')}>
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={label}
          placeholder={placeholder}
          className="h-full rounded-2xl border-border/20 bg-background/70 pr-10 pl-10 text-ellipsis"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Borrar búsqueda"
            onClick={clear}
            className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground pointer-coarse:size-9 pointer-coarse:min-h-9"
          >
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
