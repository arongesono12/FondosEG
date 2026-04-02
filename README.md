# FondosEG Dashboard - Plataforma de Gestión de Envíos

FondosEG es una aplicación moderna de gestión de transferencias y envíos, diseñada para ofrecer una experiencia premium a gestores y administradores. Este dashboard integra herramientas avanzadas de seguimiento, gestión de saldos y comunicación en tiempo real.

## 🚀 Tecnologías Principales

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router) con React 19.
- **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/) para un diseño dinámico y moderno.
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) con SSR y clientes de administración.
- **Estado Global**: [Zustand](https://github.com/pmndrs/zustand) para una gestión de estado ligera y eficiente.
- **Gráficos**: [Recharts](https://recharts.org/) con integración de temas.
- **Notificaciones**: Integración con la API de [Twilio](https://www.twilio.com/) para envíos de SMS.

## ✨ Características Destacadas

### 1. Interfaz Premium & Dual Theme
- Soporte completo para **Modo Claro** y **Modo Oscuro** con transición suave.
- Estética **Glassmorphism** utilizando la utilidad personalizada `.glass-premium`.
- Paleta de colores basada en variables CSS adaptativas (`--background`, `--foreground`, `--primary`, etc.).

### 2. Gestión de Transferencias
- Creación y seguimiento de envíos en tiempo real.
- Generación única de códigos de transferencia.
- Panel de historial detallado con filtrado por fecha y estado.

### 3. Búsqueda Global Inteligente
- Modal de búsqueda rápida (`SearchModal`) integrado en la cabecera.
- Permite localizar envíos por código, nombre del remitente/destinatario o ciudad de destino de forma instantánea.

### 4. Centro de Notificaciones (SMS)
- Seguimiento visual de las notificaciones enviadas a clientes.
- Estados de entrega integrados (Enviado, Pendiente, Fallido).
- Acceso rápido desde cualquier página del dashboard.

### 5. Arquitectura de Datos
- **Servicios Desacoplados**: Lógica de negocio organizada en la carpeta `/services` (`auth.ts`, `transfer.ts`, `sms.ts`).
- **Seguridad**: Roles de usuario definidos (`admin`, `gestor`) con políticas de acceso protegidas.
- **Optimización**: Limpieza activa de componentes redundantes y utilidades CSS obsoletas para mantener un bundle ligero.

## 🛠️ Instalación y Desarrollo

1. **Clonar el repositorio**:
   ```bash
   git clone <url-del-repositorio>
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Crear un archivo `.env.local` con las credenciales de Supabase y Twilio.

4. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```
   El dashboard estará disponible en `http://localhost:3001`.

## 📂 Estructura del Proyecto

- `/app`: Rutas del App Router y páginas del dashboard.
- `/components`: Componentes UI reutilizables y modales de layout.
- `/lib`: Configuración de Supabase, utilidades (`utils.ts`) y stores de Zustand.
- `/services`: Capa de interacción con la API y base de datos.
- `/types`: Definiciones de interfaces TypeScript para todo el modelo de datos.
- `/public`: Assets estáticos e iconos.

---
*Desarrollado con enfoque en rendimiento, estética y facilidad de uso para la gestión financiera moderna.*
