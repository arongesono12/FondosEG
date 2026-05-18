import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { ThemeProvider, themeScript } from "@/components/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

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
      <body suppressHydrationWarning className={`${poppins.variable} ${inter.variable} font-sans antialiased`}>
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
