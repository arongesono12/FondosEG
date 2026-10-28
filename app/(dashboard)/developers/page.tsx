'use client';

import { useEffect, useState } from 'react';
import { ApiDocumentation } from '@/components/developers/api-documentation';
import { ApplicationsPanel } from '@/components/developers/applications-panel';
import { useAppStore } from '@/lib/store';
import { isAdminRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

type PortalTab = 'applications' | 'docs';

const TABS: Array<{ id: PortalTab; label: string }> = [
  { id: 'applications', label: 'Aplicaciones' },
  { id: 'docs', label: 'Documentación' },
];

/** Anclas de la documentación: si la URL apunta a una, se abre esa pestaña. */
const DOC_HASHES = new Set([
  'documentacion', 'como-funciona', 'autenticacion', 'reglas', 'endpoints',
  'ejemplos', 'webhooks', 'errores', 'casaseg', 'produccion',
]);

export default function DevelopersPage() {
  const { user } = useAppStore();
  const [tab, setTab] = useState<PortalTab>('applications');
  const [baseUrl, setBaseUrl] = useState('https://fondoseg.com');

  useEffect(() => {
    setBaseUrl(window.location.origin);
    if (DOC_HASHES.has(window.location.hash.slice(1))) setTab('docs');
  }, []);

  function selectTab(next: PortalTab) {
    setTab(next);
    window.history.replaceState(null, '', next === 'docs' ? '#documentacion' : window.location.pathname);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Portal de desarrolladores</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Conecta tus aplicaciones con FondosEG para cobrar y enviar dinero a billeteras de clientes.
          </p>
        </div>
        <div role="tablist" aria-label="Secciones del portal" className="inline-flex w-fit rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`portal-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`portal-panel-${item.id}`}
              onClick={() => selectTab(item.id)}
              className={cn(
                'inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                tab === item.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div role="tabpanel" id={`portal-panel-${tab}`} aria-labelledby={`portal-tab-${tab}`}>
        {tab === 'applications'
          ? <ApplicationsPanel canIssueProduction={isAdminRole(user?.role)} />
          : <ApiDocumentation baseUrl={baseUrl} />}
      </div>
    </div>
  );
}
