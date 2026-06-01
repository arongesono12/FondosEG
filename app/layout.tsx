import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

import { ThemeProvider, themeScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "FondosEG - Gestión de Envíos de Dinero",
  description: "Plataforma profesional para gestionar envíos de dinero entre personas a través de gestores",
  icons: {
    icon: "/logo%20F/favicon.ico",
  },
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
      <body suppressHydrationWarning className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
