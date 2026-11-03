'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from '@/components/ui/hugeicons';
import type { RecordTab } from '@/lib/record-tabs';
import { cn, getInitials } from '@/lib/utils';

/** Mismo corte que `.overview-operations-body` pasa a una columna (dashboard-overview.css). */
const SINGLE_COLUMN_QUERY = '(max-width: 700px)';

export interface RecordRow {
  avatar: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  state?: ReactNode;
  value?: ReactNode;
}

interface RecordPanelProps<T> {
  /** Nombre accesible de la tarjeta. */
  label: string;
  title: string;
  subtitle?: ReactNode;
  tabs?: readonly RecordTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  tabsLabel?: string;
  /** Búsqueda, filtros o enlace de la esquina superior derecha. */
  corner?: ReactNode;
  /** Ancho por debajo del cual la esquina baja a su propia fila, si no cabe junto al título. */
  cornerRow?: 'phone' | 'laptop';
  items: readonly T[];
  getId: (item: T) => string;
  renderRow: (item: T) => RecordRow;
  renderDetail: (item: T) => ReactNode;
  listLabel: string;
  emptyList: ReactNode;
  emptyDetail: ReactNode;
  listFooter?: ReactNode;
}

/** Tarjeta oscura del dashboard: pestañas arriba, lista seleccionable a la izquierda y detalle a la derecha. */
export function RecordPanel<T>({
  label,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  tabsLabel,
  corner,
  cornerRow,
  items,
  getId,
  renderRow,
  renderDetail,
  listLabel,
  emptyList,
  emptyDetail,
  listFooter,
}: RecordPanelProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const selected = items.find((item) => getId(item) === selectedId) ?? items[0];
  const selectedKey = selected === undefined ? null : getId(selected);

  const select = (id: string) => {
    setSelectedId(id);
    // En una columna el detalle queda debajo de toda la lista y el cambio no se vería.
    if (window.matchMedia(SINGLE_COLUMN_QUERY).matches) detailRef.current?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className="overview">
      <section className="overview-operations" aria-label={label}>
        <header className="overview-operations-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <span>{subtitle}</span>}
          </div>
          {tabs && (
            <div className="overview-operation-tabs" role="group" aria-label={tabsLabel}>
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={activeTab === tab.value}
                  className={cn(activeTab === tab.value && 'is-active')}
                  onClick={() => onTabChange?.(tab.value)}
                >
                  {tab.label}
                  {tab.count !== undefined && <span>{tab.count}</span>}
                </button>
              ))}
            </div>
          )}
          {corner && <div className="overview-operations-corner" data-row={cornerRow}>{corner}</div>}
        </header>
        <div className="overview-operations-body">
          <div className="overview-record-column">
            <div className="overview-transfer-list" role="group" aria-label={listLabel}>
              {items.length ? items.map((item) => {
                const id = getId(item);
                const row = renderRow(item);
                return (
                  <button
                    key={id}
                    type="button"
                    className={cn('overview-transfer', selectedKey === id && 'is-selected')}
                    aria-pressed={selectedKey === id}
                    onClick={() => select(id)}
                  >
                    {row.avatar}
                    <span className="overview-transfer-identity">
                      <strong>{row.title}</strong>
                      {row.subtitle && <small>{row.subtitle}</small>}
                    </span>
                    {row.state && <span className="overview-transfer-state">{row.state}</span>}
                    {row.value && <strong className="overview-transfer-amount">{row.value}</strong>}
                  </button>
                );
              }) : emptyList}
            </div>
            {listFooter}
          </div>
          <div ref={detailRef} className="overview-transfer-detail" aria-live="polite" aria-atomic="true">
            {selected === undefined ? emptyDetail : renderDetail(selected)}
          </div>
        </div>
      </section>
    </div>
  );
}

interface RecordAvatarProps {
  name: string;
  src?: string | null;
}

export function RecordAvatar({ name, src }: RecordAvatarProps) {
  const initials = getInitials(name);
  if (!src) return <span className="overview-person-avatar">{initials}</span>;
  return (
    <span className="overview-person-avatar overflow-hidden">
      <Avatar className="h-full w-full">
        <AvatarImage src={src} alt="" />
        <AvatarFallback className="bg-transparent">{initials}</AvatarFallback>
      </Avatar>
    </span>
  );
}

export interface RecordDetailColumn {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
  avatar?: ReactNode;
}

interface RecordDetailHeadingProps {
  label: string;
  title: ReactNode;
  badge?: ReactNode;
  columns: readonly RecordDetailColumn[];
}

export function RecordDetailHeading({ label, title, badge, columns }: RecordDetailHeadingProps) {
  return (
    <div className="overview-detail-heading">
      <div>
        <span className="overview-detail-label">{label}</span>
        <div className="overview-detail-code">
          <h3>{title}</h3>
          {badge && <span>{badge}</span>}
        </div>
      </div>
      {columns.map((column) => {
        const text = (
          <>
            <strong>{column.primary}</strong>
            {column.secondary && <small>{column.secondary}</small>}
          </>
        );
        return (
          <div key={column.label}>
            <span className="overview-detail-label">{column.label}</span>
            {column.avatar ? <div className="overview-recipient">{column.avatar}<div>{text}</div></div> : text}
          </div>
        );
      })}
    </div>
  );
}

export interface RecordTile {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}

interface RecordDetailTilesProps {
  tiles: readonly RecordTile[];
  /** Mosaico punteado con la acción principal del registro. */
  action?: ReactNode;
}

export function RecordDetailTiles({ tiles, action }: RecordDetailTilesProps) {
  return (
    <div className="overview-detail-tiles">
      {tiles.map((tile) => (
        <div key={tile.label}>
          {tile.icon}
          <strong>{tile.value}</strong>
          <span>{tile.label}</span>
        </div>
      ))}
      {action}
    </div>
  );
}

interface RecordTileActionProps {
  label: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
}

export function RecordTileAction({ label, icon = <Plus />, href, onSelect }: RecordTileActionProps) {
  if (href) return <Link href={href} className="overview-add-transfer">{icon}<span>{label}</span></Link>;
  return <button type="button" className="overview-add-transfer" onClick={onSelect}>{icon}<span>{label}</span></button>;
}

export interface RecordFooterItem {
  label: string;
  value: ReactNode;
}

interface RecordDetailFooterProps {
  items: readonly RecordFooterItem[];
  actions?: ReactNode;
}

export function RecordDetailFooter({ items, actions }: RecordDetailFooterProps) {
  return (
    <footer className="overview-detail-footer">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
      {actions && <div className="overview-detail-actions">{actions}</div>}
    </footer>
  );
}

interface RecordDetailActionProps {
  children: ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Nombre accesible cuando el texto visible no basta. */
  label?: string;
  secondary?: boolean;
}

export function RecordDetailAction({ children, href, onSelect, label, secondary }: RecordDetailActionProps) {
  const className = cn('overview-detail-action', secondary && 'is-secondary');
  if (href) return <Link href={href} aria-label={label} className={className}>{children}</Link>;
  return <button type="button" aria-label={label} className={className} onClick={onSelect}>{children}</button>;
}

/** Texto en lugar de una acción que no está disponible para este registro. */
export function RecordDetailNote({ children }: { children: ReactNode }) {
  return <span className="overview-detail-note">{children}</span>;
}

interface RecordListEmptyProps {
  children: ReactNode;
  role?: 'alert' | 'status';
  busy?: boolean;
}

export function RecordListEmpty({ children, role, busy }: RecordListEmptyProps) {
  return <div className="overview-empty" role={role} aria-busy={busy}>{children}</div>;
}

interface RecordDetailEmptyProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function RecordDetailEmpty({ title, description, children }: RecordDetailEmptyProps) {
  return (
    <div className="overview-empty overview-empty-detail">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
