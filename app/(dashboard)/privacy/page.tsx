'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Privacidad
        </Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Política de privacidad del dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Explicamos cómo tratamos tus datos operativos, de contacto y de actividad dentro de la plataforma.
        </p>
      </section>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Qué datos recopilamos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Información de perfil, teléfonos operativos y registros de actividad vinculados a envíos y retiros.</p>
          <p>Datos de seguridad y auditoría necesarios para validar operaciones y prevenir fraudes.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Uso de la información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Operación diaria del sistema, conciliación financiera y soporte a usuarios.</p>
          <p>Mejora del rendimiento y detección de errores en el flujo de envíos.</p>
        </CardContent>
      </Card>
    </div>
  );
}
