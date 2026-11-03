'use client';

import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarDays, ChevronDown } from '@/components/ui/hugeicons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateRangeLabel } from '@/lib/date-range';
import { cn } from '@/lib/utils';

const FIELD_LABEL_CLASS = 'grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2 text-xs font-semibold text-muted-foreground';
const FIELD_INPUT_CLASS = 'h-10 rounded-2xl border-border/20 bg-background/70 px-3 pointer-coarse:h-11';

// El menú de Radix reserva las flechas, el tabulador y la escritura para moverse
// entre opciones; los campos de fecha los necesitan. `Escape` sigue cerrando.
function keepKeysInFields(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Escape') event.stopPropagation();
}

interface DateRangeFilterProps {
  /** Extremos en formato `YYYY-MM-DD`; vacío significa sin límite. */
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

/** Filtro de fechas compacto: un solo botón que despliega los extremos «Desde» y «Hasta». */
export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const active = Boolean(from || to);
  const label = formatDateRangeLabel(from, to);

  const clear = () => {
    onFromChange('');
    onToChange('');
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-label={active ? `Fechas: ${label}` : undefined}
          className={cn('min-w-0 justify-between rounded-xl px-3 font-black', active ? 'shrink-[0.25]' : 'shrink-0')}
        >
          <CalendarDays />
          <span className="truncate tabular-nums">{label}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      {/* Contiene un formulario, no opciones de menú: de ahí el rol de diálogo. */}
      <DropdownMenuContent
        role="dialog"
        aria-orientation={undefined}
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="dashboard-inset w-72 max-w-(--radix-dropdown-menu-content-available-width) p-4"
      >
        <div className="space-y-3" onKeyDown={keepKeysInFields}>
          <Label className={FIELD_LABEL_CLASS}>
            Desde
            {/* Con el foco ya dentro, Radix no lo lleva al contenedor, donde el tabulador no funcionaría. */}
            <Input autoFocus type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} className={FIELD_INPUT_CLASS} />
          </Label>
          <Label className={FIELD_LABEL_CLASS}>
            Hasta
            <Input type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} className={FIELD_INPUT_CLASS} />
          </Label>
          <Button type="button" variant="ghost" disabled={!active} onClick={clear} className="w-full font-black">
            Limpiar fechas
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
