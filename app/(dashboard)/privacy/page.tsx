'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <Card asChild interactive={false} className="rounded-4xl p-6 md:p-8"><section>
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Privacidad
        </Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Política de privacidad del dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Explicamos cómo tratamos tus datos operativos, de contacto y de actividad dentro de la plataforma.
        </p>
      </section></Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Qué datos recopilamos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Recopilamos datos de identificación y contacto necesarios para operar la cuenta, como nombre, correo electrónico, teléfono, rol dentro del sistema y, cuando proceda, documentación asociada al perfil.</p>
          <p>También tratamos información operativa generada dentro del dashboard, incluyendo envíos, pagos, recargas, confirmaciones, correcciones administrativas y registros de actividad vinculados a cada usuario.</p>
          <p>Con fines de seguridad, mantenemos evidencias técnicas y de auditoría como estados de sesión, trazabilidad de acciones, incidencias, validaciones internas y metadatos necesarios para prevenir fraude, abuso o accesos no autorizados.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Uso de la información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Utilizamos la información para la operación diaria del servicio, la gestión de usuarios, la conciliación financiera, la ejecución de envíos, los pagos en destino y el soporte operativo dentro del dashboard.</p>
          <p>Los datos también se emplean para verificar identidades, revisar movimientos sensibles, atender incidencias, responder solicitudes de soporte y reforzar los controles internos sobre saldos, retiros y confirmaciones.</p>
          <p>De forma adicional, cierta información puede utilizarse para mejorar el rendimiento de la plataforma, detectar errores de funcionamiento, corregir inconsistencias y fortalecer la estabilidad del sistema.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Conservación y acceso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Conservamos la información durante el tiempo necesario para cumplir finalidades operativas, contractuales, contables, legales y de seguridad, especialmente cuando existen movimientos financieros o trazas de auditoría asociadas.</p>
          <p>El acceso a los datos se limita a personal autorizado, administradores habilitados y procesos internos del sistema que necesitan esa información para prestar el servicio o mantener la integridad operativa del dashboard.</p>
          <p>Cuando un usuario solicita cambios en su perfil, la plataforma puede actualizar sus datos visibles, pero ciertos registros históricos y operativos deben mantenerse por razones de control, seguridad y trazabilidad.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Derechos y contacto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Los usuarios pueden solicitar revisión, actualización o corrección de los datos de perfil disponibles en el dashboard, así como comunicar incidencias relacionadas con privacidad o acceso a la cuenta.</p>
          <p>Las solicitudes se evaluarán conforme a las obligaciones operativas y legales aplicables, teniendo en cuenta que algunos registros no pueden eliminarse de inmediato cuando están vinculados a auditoría, soporte o movimientos financieros.</p>
          <p>Para cualquier consulta relacionada con privacidad, tratamiento de datos o actividad de la cuenta, el usuario debe dirigirse al canal oficial de soporte o al equipo administrativo autorizado de FondosEG.</p>
        </CardContent>
      </Card>
    </div>
  );
}
