import type { Metadata } from "next";
import Script from "next/script";
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
