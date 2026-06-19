Actúa como un auditor senior de ciberseguridad especializado en aplicaciones React, Next.js, React Native, Expo y aplicaciones móviles conectadas a APIs.

Necesito que analices mi proyecto para detectar vulnerabilidades relacionadas con la exposición de credenciales, variables de entorno, claves API, tokens, secretos, endpoints sensibles y configuraciones inseguras.

Tu objetivo principal es evitar que mi aplicación exponga información sensible en el frontend, en el bundle final, en repositorios Git, en builds públicas o en herramientas de desarrollo.

Analiza el proyecto con enfoque profesional y explícame los riesgos, el impacto y cómo corregirlos.

## Contexto del proyecto

El proyecto puede ser:

- Aplicación web con React
- Aplicación web con Next.js
- Aplicación móvil con React Native o Expo
- Aplicación conectada a backend/API
- Aplicación que usa servicios externos como Supabase, Firebase, Stripe, Flutterwave, Twilio, MailerSend, Google APIs u otros proveedores

## Objetivos del análisis

Revisa especialmente:

1. Variables de entorno mal configuradas.
2. Credenciales expuestas en el frontend.
3. Uso incorrecto de prefijos públicos como:
   - `NEXT_PUBLIC_`
   - `EXPO_PUBLIC_`
   - `VITE_`
   - `REACT_APP_`
4. API keys visibles en el bundle del cliente.
5. Tokens privados usados en componentes frontend.
6. Secretos incluidos directamente en el código fuente.
7. Archivos `.env` subidos al repositorio.
8. Falta de `.gitignore` adecuado.
9. Uso inseguro de claves de Supabase, Firebase, Stripe, Twilio, Flutterwave u otros servicios.
10. Endpoints backend que aceptan peticiones sin validación.
11. Falta de autenticación o autorización en rutas protegidas.
12. Rutas API de Next.js mal protegidas.
13. Server Actions, Middleware o API Routes que puedan filtrar información sensible.
14. Logs que imprimen tokens, credenciales o datos personales.
15. Configuraciones inseguras en producción.
16. Exposición de secretos en builds, Dockerfiles, GitHub Actions, Vercel, Netlify, Expo EAS o CI/CD.
17. CORS mal configurado.
18. Falta de rate limiting en rutas críticas.
19. Falta de validación de entradas del usuario.
20. Posibles vulnerabilidades XSS, CSRF, SSRF, IDOR o exposición de datos.

## Reglas importantes

Ten en cuenta estas reglas:

- Nunca deben usarse claves privadas en componentes del frontend.
- Todo lo que esté en React, Next.js Client Components, React Native o Expo puede ser inspeccionado por el usuario final.
- Las variables con prefijos públicos como `NEXT_PUBLIC_`, `EXPO_PUBLIC_`, `VITE_` o `REACT_APP_` deben considerarse públicas.
- Las claves secretas deben vivir únicamente en el backend, API Routes, Server Actions seguras, funciones serverless o servidores privados.
- Las claves públicas solo deben usarse si el proveedor las diseñó para ser públicas.
- No debo confiar en ocultar claves dentro del código compilado, porque pueden extraerse.
- El archivo `.env` real no debe subirse nunca al repositorio.
- Debe existir un archivo `.env.example` sin valores reales.
- Debe revisarse si el historial de Git ya contiene secretos filtrados.

## Tareas que debes realizar

Analiza el código y entrégame un informe con esta estructura:

### 1. Resumen ejecutivo

Explica de forma clara el estado general de seguridad del proyecto.

Clasifica el riesgo general como:

- Bajo
- Medio
- Alto
- Crítico

### 2. Hallazgos críticos

Lista las vulnerabilidades más graves encontradas.

Para cada hallazgo incluye:

- Archivo afectado
- Línea o fragmento de código afectado
- Descripción del problema
- Nivel de severidad
- Riesgo real
- Cómo podría explotarse
- Solución recomendada
- Código corregido si aplica

### 3. Revisión de variables de entorno

Revisa todas las variables usadas en el proyecto y clasifícalas en una tabla:

| Variable | Estado | Debe ser pública | Debe ser privada | Riesgo | Recomendación |
|---|---|---|---|---|---|

Ejemplos de clasificación:

- `NEXT_PUBLIC_SUPABASE_URL`: puede ser pública si corresponde.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: puede ser pública solo si las políticas RLS están bien configuradas.
- `SUPABASE_SERVICE_ROLE_KEY`: nunca debe estar en frontend.
- `STRIPE_SECRET_KEY`: nunca debe estar en frontend.
- `TWILIO_AUTH_TOKEN`: nunca debe estar en frontend.
- `FLUTTERWAVE_SECRET_KEY`: nunca debe estar en frontend.
- `MAILERSEND_API_KEY`: nunca debe estar en frontend.
- `DATABASE_URL`: nunca debe estar en frontend.
- `JWT_SECRET`: nunca debe estar en frontend.

### 4. Revisión específica para Next.js

Si el proyecto usa Next.js, revisa:

- Client Components con `"use client"`
- Server Components
- API Routes
- Route Handlers
- Server Actions
- Middleware
- `next.config.js`
- Variables `NEXT_PUBLIC_`
- Uso de cookies
- Manejo de sesiones
- Autenticación
- Autorización
- Protección de rutas privadas
- Exposición accidental de datos desde el servidor al cliente

Indica si alguna lógica sensible debería moverse a:

- `/app/api`
- `/pages/api`
- Server Actions
- Backend externo
- Edge Functions
- Funciones serverless

### 5. Revisión específica para React Native / Expo

Si el proyecto usa React Native o Expo, revisa:

- Variables `EXPO_PUBLIC_`
- Uso de secrets en el bundle móvil
- Configuración de `app.json`
- Configuración de `eas.json`
- Acceso a APIs externas desde el cliente móvil
- Tokens embebidos en la app
- Riesgo de ingeniería inversa del APK/IPA
- Uso correcto de backend intermedio
- Almacenamiento seguro de tokens
- Uso de SecureStore, Keychain o Keystore

Indica qué información nunca debe estar dentro de la app móvil compilada.

### 6. Revisión de servicios externos

Analiza integraciones como:

- Supabase
- Firebase
- Stripe
- Flutterwave
- Twilio
- MailerSend
- Google APIs
- AWS
- Cloudinary
- Vercel
- Netlify
- GitHub Actions

Para cada servicio, dime:

- Qué claves son públicas
- Qué claves son privadas
- Qué claves están mal ubicadas
- Qué permisos deberían limitarse
- Qué configuración adicional debo revisar

### 7. Revisión de repositorio Git

Comprueba si hay riesgo de exposición por:

- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- Archivos JSON con credenciales
- Commits antiguos con secretos
- Logs
- Backups
- Archivos comprimidos
- Configuraciones de despliegue

Recomiéndame comandos para revisar secretos, por ejemplo:

```bash
git log --all --full-history -- .env
git grep -n "SECRET"
git grep -n "API_KEY"
git grep -n "TOKEN"
git grep -n "PASSWORD"