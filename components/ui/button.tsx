import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Con puntero táctil todo botón mide al menos 44px de alto (y 44×44 el de
// icono): `size="sm"` se quedaba en 36px en las filas de las tablas. Se decide
// por el puntero y no por el ancho, igual que los controles de modals.css,
// para no inflar las tablas densas en un escritorio con ratón.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--app-control-radius)] text-sm font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [@media(pointer:coarse)]:min-h-11",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(236,72,153,0.18)] hover:bg-primary/90",
        brand:
          "bg-brand-gradient text-white shadow-lg shadow-pink-500/25 [@media(hover:hover)]:hover:scale-[1.01] hover:shadow-xl hover:shadow-pink-500/30",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-none hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8",
        xl: "h-12 gap-3 px-7 font-semibold [&_svg]:size-[17px]",
        icon: "size-10 [@media(pointer:coarse)]:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
