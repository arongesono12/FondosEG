'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CookiesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/10 bg-card/50 p-6 shadow-xl shadow-black/5 backdrop-blur-xl md:p-8">
        <Badge className="rounded-full border border-white/20 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Cookies
        </Badge>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Cookies del dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
          Usamos cookies esenciales para mantener la sesión y mejorar la experiencia en el panel.
        </p>
      </section>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Cookies esenciales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Las cookies esenciales permiten mantener la sesión autenticada, validar el acceso a secciones protegidas y asegurar que cada usuario vea únicamente la información correspondiente a su cuenta y permisos.</p>
          <p>También ayudan a sostener funciones críticas del dashboard como la navegación interna, el estado de autenticación, la protección de acciones sensibles y la continuidad del uso durante la sesión.</p>
          <p>Sin estas cookies, el dashboard no puede funcionar correctamente y es posible que algunas operaciones, validaciones o controles de seguridad no estén disponibles.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Preferencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>Algunas cookies o mecanismos equivalentes guardan preferencias del usuario para mejorar la experiencia, como el tema visual, la moneda preferida y otras configuraciones ligeras del panel.</p>
          <p>Estas preferencias no sustituyen los controles de seguridad ni contienen por sí solas información suficiente para operar una cuenta, pero sí ayudan a ofrecer una experiencia más estable y personalizada.</p>
        </CardContent>
      </Card>

      <Card className="glass-premium border-border/10 bg-card/40 shadow-xl shadow-black/5">
        <CardHeader>
          <CardTitle className="text-xl font-black text-foreground">Gestión y limitaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm font-semibold text-muted-foreground">
          <p>El usuario puede gestionar ciertas cookies desde la configuración del navegador, aunque al desactivar cookies esenciales podría perder acceso a funciones críticas del dashboard o interrumpir su sesión actual.</p>
          <p>En entornos compartidos o dispositivos públicos, recomendamos cerrar sesión al finalizar y evitar almacenar configuraciones sensibles que puedan comprometer el acceso posterior a la cuenta.</p>
        </CardContent>
      </Card>
    </div>
  );
}
