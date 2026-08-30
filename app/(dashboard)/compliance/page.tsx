'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  MessageSquareWarning,
  ShieldCheck,
} from 'lucide-react';
import { PAYMENT_COMPLAINT_TARGET_DAYS, PAYMENT_REGULATION } from '@/lib/compliance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const controls = [
  {
    title: 'Información y consentimiento',
    description: 'Las órdenes muestran importe, comisión, beneficiario, canal y plazo antes de confirmarse.',
  },
  {
    title: 'Trazabilidad',
    description: 'Las operaciones, cambios de estado y consentimientos quedan vinculados a referencias auditables.',
  },
  {
    title: 'Comprobantes durables',
    description: 'Cada transferencia registrada puede consultarse mediante un comprobante imprimible.',
  },
  {
    title: 'Reclamaciones',
    description: 'El usuario recibe una referencia, acuse de recepción y fecha objetivo de respuesta.',
  },
];

export default function CompliancePage() {
  const [transactionReference, setTransactionReference] = useState('');
  const [category, setCategory] = useState('operacion_no_reconocida');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    reference: string;
    acknowledged_at: string;
    target_response_at: string;
  } | null>(null);

  const submitComplaint = async () => {
    if (!message.trim()) {
      setError('Describe la incidencia para registrar la reclamación.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'payment_complaint',
          transactionReference,
          complaintCategory: category,
          message,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo registrar la reclamación');
      }
      setReceipt(data.complaint);
      setMessage('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo registrar la reclamación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card asChild interactive={false} className="rounded-4xl p-6 md:p-8"><section>
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          CEMAC / COBAC
        </Badge>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Regulación y cumplimiento de pagos
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground">
              Controles técnicos alineados con el Reglamento n.º {PAYMENT_REGULATION.code}, adoptado el
              21 de diciembre de 2018.
            </p>
          </div>
          <Button asChild variant="brand" className="h-11 rounded-xl font-black">
            <a href={PAYMENT_REGULATION.officialUrl} target="_blank" rel="noreferrer">
              <BookOpen className="mr-2 h-4 w-4" />
              Documento oficial
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section></Card>

      <div className="grid gap-4 md:grid-cols-2">
        {controls.map((control) => (
          <Card key={control.title} className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
            <CardContent className="flex gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-black text-foreground">{control.title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{control.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-black">
            <MessageSquareWarning className="h-5 w-5 text-primary" />
            Registrar una reclamación de pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {receipt ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
                <FileCheck2 className="h-6 w-6" />
                <p className="font-black">Reclamación recibida</p>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-bold uppercase text-muted-foreground">Referencia</dt>
                  <dd className="mt-1 font-mono font-black text-foreground">{receipt.reference}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted-foreground">Acuse</dt>
                  <dd className="mt-1 font-bold text-foreground">
                    {new Date(receipt.acknowledged_at).toLocaleString('es')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted-foreground">Respuesta objetivo</dt>
                  <dd className="mt-1 font-bold text-foreground">
                    {new Date(receipt.target_response_at).toLocaleDateString('es')}
                  </dd>
                </div>
              </dl>
              <Button type="button" variant="outline" className="mt-5 rounded-xl" onClick={() => setReceipt(null)}>
                Registrar otra reclamación
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transaction-reference">Referencia de operación</Label>
                  <Input
                    id="transaction-reference"
                    value={transactionReference}
                    onChange={(event) => setTransactionReference(event.target.value)}
                    placeholder="Ej. TX-123456"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complaint-category">Motivo</Label>
                  <select
                    id="complaint-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="operacion_no_reconocida">Operación no reconocida</option>
                    <option value="importe_incorrecto">Importe o comisión incorrectos</option>
                    <option value="beneficiario_no_recibio">Beneficiario no recibió los fondos</option>
                    <option value="retraso">Retraso en la ejecución</option>
                    <option value="otro">Otro motivo</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="complaint-message">Descripción</Label>
                <Textarea
                  id="complaint-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Explica qué ocurrió, cuándo y qué solución solicitas."
                  className="min-h-32 rounded-xl"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-muted-foreground">
                  Plazo interno objetivo: {PAYMENT_COMPLAINT_TARGET_DAYS} días naturales. Conserva la referencia
                  para cualquier seguimiento.
                </p>
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={submitComplaint}
                  className="h-11 rounded-xl bg-brand-gradient font-black text-white"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {submitting ? 'Registrando...' : 'Registrar reclamación'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm font-semibold leading-6 text-amber-800 dark:text-amber-200">
        Este módulo documenta controles técnicos de FondosEG. La autorización para prestar servicios de pago,
        la protección de fondos, la lucha contra el blanqueo, la externalización y los reportes regulatorios
        requieren procedimientos corporativos y validación de las autoridades competentes.
      </div>
    </div>
  );
}
