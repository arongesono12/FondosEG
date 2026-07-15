'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PoliciesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Políticas
        </Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Políticas operativas del dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-muted-foreground">
          Lineamientos para el uso correcto del sistema, la seguridad y el control de operaciones.
        </p>
      </section>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Uso permitido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-medium text-muted-foreground">
          <p>El dashboard debe utilizarse exclusivamente para operaciones autorizadas, registradas y vinculadas a la actividad legítima del usuario dentro de FondosEG.</p>
          <p>Cada cuenta es personal e intransferible en la medida permitida por la operativa del sistema, por lo que no debe compartirse con terceros ni emplearse fuera del alcance del rol asignado.</p>
          <p>Cualquier uso indebido, intento de manipulación, acceso no autorizado o actuación contraria a los controles internos podrá dar lugar a restricciones de acceso, revisión administrativa o suspensión de la cuenta.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Seguridad y auditoría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-medium text-muted-foreground">
          <p>El sistema registra eventos críticos, movimientos operativos, cambios relevantes y acciones administrativas con el fin de mantener trazabilidad, control interno y capacidad de revisión posterior.</p>
          <p>Las recargas, pagos, correcciones, confirmaciones y demás operaciones sensibles pueden estar sujetas a validaciones internas, revisión de saldos, comprobaciones documentales y medidas de prevención de fraude.</p>
          <p>Los usuarios deben colaborar con los procesos de verificación y mantener actualizada la información de perfil cuando ello sea necesario para la continuidad operativa o el cumplimiento de políticas internas.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Responsabilidades del usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-medium text-muted-foreground">
          <p>El usuario es responsable de custodiar sus credenciales, proteger sus dispositivos de acceso y notificar de inmediato cualquier uso sospechoso, pérdida de acceso o incidencia de seguridad relacionada con su cuenta.</p>
          <p>También debe revisar cuidadosamente la información introducida antes de confirmar operaciones, especialmente nombres, teléfonos, importes, destinos y cualquier dato que pueda afectar la ejecución del servicio.</p>
          <p>La plataforma podrá conservar registros de las acciones realizadas por el usuario como evidencia de operación, soporte, conciliación y cumplimiento de controles internos.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Incumplimientos y medidas internas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-medium text-muted-foreground">
          <p>Cuando se detecten comportamientos anómalos, inconsistencias operativas o posibles incumplimientos, FondosEG podrá aplicar medidas internas de control como revisión manual, limitación temporal de funciones o bloqueo preventivo de la cuenta.</p>
          <p>Estas medidas buscan proteger la integridad del sistema, la seguridad de los usuarios y la correcta ejecución de los flujos financieros gestionados desde el dashboard.</p>
          <p>La continuidad del acceso podrá depender de la colaboración del usuario con el soporte o con el equipo administrativo para aclarar la incidencia y validar la legitimidad de la actividad observada.</p>
        </CardContent>
      </Card>
    </div>
  );
}
