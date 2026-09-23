"use client"

import * as React from "react"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/**
 * Interruptor de tema: un control de dos estados, no un icono que cambia de
 * forma. Es el mismo en la cabecera del dashboard, en la landing, en el
 * acceso, en el onboarding, en el portal de desarrolladores y en la
 * documentación; la apariencia vive en `app/styles/theme-switch.css`.
 *
 * `role="switch"` + `aria-checked` en vez de un botón con dos iconos: un
 * lector de pantalla anuncia «Modo oscuro, activado» y no hay que deducir el
 * estado a partir de si se ve un sol o una luna.
 *
 * Hasta que monta no se sabe el tema resuelto (el servidor no lo conoce), así
 * que se pinta la misma caja desactivada: sin eso la cabecera daba un salto.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  const track = (
    <span className="theme-switch-track" aria-hidden="true">
      <span className="theme-switch-knob" />
    </span>
  )

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn("theme-switch", className)}
        data-pending="true"
        disabled
        aria-hidden="true"
      >
        {track}
      </button>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Modo oscuro"
      className={cn("theme-switch", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {track}
    </button>
  )
}
