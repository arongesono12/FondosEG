'use client';

import { useState } from 'react';
import { Check, Copy } from '@/components/ui/hugeicons';
import { cn } from '@/lib/utils';

export interface CodeTab {
  id: string;
  label: string;
  code: string;
}

interface CodeBlockProps {
  /** Una o varias variantes (cURL, TypeScript…) del mismo ejemplo. */
  tabs: CodeTab[];
  /** Encabezado cuando solo hay una variante. */
  title?: string;
  className?: string;
}

const COPIED_FEEDBACK_MS = 1600;

export function CodeBlock({ tabs, title, className }: CodeBlockProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const [copied, setCopied] = useState(false);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn('dashboard-inset overflow-hidden rounded-2xl border border-border text-foreground', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        {tabs.length > 1 ? (
          <div role="tablist" aria-label="Lenguaje del ejemplo" className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === active.id}
                onClick={() => setActiveId(tab.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  tab.id === active.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-1 text-xs font-medium text-slate-400">{title ?? active.label}</span>
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Copiar código"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 font-mono text-[12.5px] leading-6"><code>{active.code}</code></pre>
    </div>
  );
}
