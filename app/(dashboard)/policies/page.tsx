'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PoliciesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Políticas
        </Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Políticas operativas del dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Lineamientos para el uso correcto del sistema, la seguridad y el control de operaciones.
        </p>
      </section>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Uso permitido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>El dashboard debe usarse únicamente para operaciones autorizadas y registradas.</p>
          <p>Cualquier intento de manipulación o acceso indebido puede suspender la cuenta.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Seguridad y auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Se registran eventos críticos y movimientos para trazabilidad.</p>
          <p>Las recargas y pagos requieren validaciones internas y controles de saldo.</p>
        </CardContent>
      </Card>
    </div>
  );
}
