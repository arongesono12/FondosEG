import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Renderiza la tarjeta como su hijo en lugar de un `<div>`. Existe para que
   * el landing y la documentación usen ESTA tarjeta sin perder su etiqueta:
   * allí las tarjetas son `<article>`, `<section>` o el propio `<Link>` que las
   * hace clicables. Sin él habría que envolverlas en un div extra o volver a
   * pintar la superficie a mano en CSS, que es la duplicación que se eliminó.
   */
  asChild?: boolean
  /**
   * El realce al pasar el ratón dice «esto responde al clic»: acierta en un
   * tile del dashboard o en una tarjeta que es un enlace, y estorba en una
   * superficie de lectura larga —un documento legal o un bloque de referencia
   * de la API—, donde escalar media página al pasar por encima marea.
   */
  interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild = false, interactive = true, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        ref={ref}
        className={cn(
          // `transition-all` animaba también propiedades de layout, y en táctil el
          // :hover se queda pegado tras el tap, dejando tarjetas escaladas de forma
          // permanente y desalineadas respecto a sus vecinas de rejilla.
          "glass rounded-3xl bg-card text-card-foreground transition-[transform,box-shadow] duration-200 ease-out",
          interactive && "[@media(hover:hover)]:hover:scale-[1.01]",
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
