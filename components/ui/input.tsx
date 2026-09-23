import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

// 16px con puntero táctil: por debajo, Safari de iOS amplía la página al
// enfocar el campo y no vuelve. Dentro del dashboard el remapeo tipográfico
// devuelve `.text-sm` a 14px; allí lo corrige dashboard-responsive.css.
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-[var(--app-control-radius)] border border-input bg-background px-4 py-2 text-sm [@media(pointer:coarse)]:text-base shadow-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
