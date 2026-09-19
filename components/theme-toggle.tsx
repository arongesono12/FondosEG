"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

/**
 * Los tres controles de la cabecera —notificaciones, tema y avatar— comparten
 * una sola medida: 40px en círculo. El avatar ya venía a 40px, así que es él
 * quien fija el ritmo; antes este botón medía 44px con esquinas de 16px y
 * rompía la fila. El color sale de los tokens del proyecto: nada de rosas ni
 * grises sueltos de la paleta de Tailwind.
 */
const TRIGGER_CLASSES =
  "h-10 w-10 rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-primary"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={TRIGGER_CLASSES} disabled aria-hidden="true">
        <Sun className="h-5 w-5" />
        <span className="sr-only">Cambiar tema</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`relative ${TRIGGER_CLASSES}`}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  )
}
