import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/poppins/900.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "./globals.css";

import { ThemeProvider, themeScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "FondosEG - Gestión de Envíos de Dinero",
  description: "Plataforma profesional para gestionar envíos de dinero entre personas a través de gestores",
  manifest: "/logo%20F/manifest.json?v=lfondoseg",
  icons: {
    icon: [
      { url: "/logo%20fondosEG/LFondosEG.png?v=lfondoseg", type: "image/png" },
      { url: "/logo%20F/favicon.ico?v=lfondoseg", type: "image/x-icon" },
    ],
    apple: "/logo%20F/apple-icon.png?v=lfondoseg",
  },
};

// `viewportFit: cover` es lo que activa los `env(safe-area-inset-*)` del CSS:
// sin él evalúan a 0px y el notch/home indicator tapan el contenido.
// `resizes-content` hace que `100dvh` y los elementos fijos se encojan al abrir
// el teclado virtual, que es lo que asume todo el shell móvil y los modales.
// No se fija `maximumScale` ni `userScalable`: bloquear el zoom rompe accesibilidad.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script id="fondoseg-theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      {/* `ClerkProvider` va DENTRO de <body>, no envolviendo <html>. */}
      <body suppressHydrationWarning className="font-sans antialiased">
        <ClerkProvider
          localization={esES}
          // Sin esto, cualquier redirección iniciada por Clerk lleva a su
          // página alojada en accounts.dev en lugar de a las pantallas propias.
          signInUrl="/login"
          signUpUrl="/register"
          appearance={clerkAppearance}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
