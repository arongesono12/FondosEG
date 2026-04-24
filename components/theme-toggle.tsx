"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm shadow-slate-200/70 transition-all duration-300 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:shadow-black/20 dark:hover:border-pink-500/30 dark:hover:bg-pink-500/15 dark:hover:text-pink-300"
        disabled
        aria-hidden="true"
      >
        <Sun className="h-5 w-5" />
        <span className="sr-only">Cambiar tema</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-11 w-11 rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-sm shadow-slate-200/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:shadow-black/20 dark:hover:border-pink-500/30 dark:hover:bg-pink-500/15 dark:hover:text-pink-300"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Cambiar tema</span>
    </Button>
  )
}
