'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Copy } from '@/components/ui/hugeicons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CodeBlock } from '@/components/developers/code-block';

export interface RevealedValue {
  label: string;
  value: string;
}

interface SecretRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  values: RevealedValue[];
  /** Bloque `.env` listo para pegar en el servidor del integrador. */
  envSnippet?: string;
}

const COPIED_FEEDBACK_MS = 1600;

/**
 * Los secretos solo existen en claro en esta respuesta: FondosEG guarda el
 * hash (API secret) o el valor cifrado (webhook). Se muestran una vez.
 */
export function SecretRevealDialog({ open, onOpenChange, title, description, values, envSnippet }: SecretRevealDialogProps) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  async function copy(item: RevealedValue) {
    try {
      await navigator.clipboard.writeText(item.value);
      setCopiedLabel(item.label);
      window.setTimeout(() => setCopiedLabel(null), COPIED_FEEDBACK_MS);
    } catch {
      setCopiedLabel(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Cópialo ahora: por seguridad no se vuelve a mostrar. Si lo pierdes, rota la credencial.</p>
          </div>

          <dl className="space-y-3">
            {values.map((item) => (
              <div key={item.label} className="space-y-1">
                <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                <dd className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 py-1.5 pl-3 pr-1.5">
                  <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{item.value}</code>
                  <Button type="button" variant="ghost" size="sm" onClick={() => copy(item)} aria-label={`Copiar ${item.label}`}>
                    {copiedLabel === item.label ? <Check /> : <Copy />}
                    {copiedLabel === item.label ? 'Copiado' : 'Copiar'}
                  </Button>
                </dd>
              </div>
            ))}
          </dl>

          {envSnippet && <CodeBlock title="Variables de entorno del servidor" tabs={[{ id: 'env', label: '.env', code: envSnippet }]} />}
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Ya lo he guardado</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
