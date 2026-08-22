import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

/**
 * Cómo se comporta el modal por debajo del breakpoint móvil del dashboard (<1024px):
 *  - `centered`: tarjeta centrada en la pantalla (POR DEFECTO).
 *  - `fullscreen`: ocupa toda la pantalla como una vista nativa.
 *  - `none`: sin reglas compartidas; el modal aporta su propio diseño móvil.
 *
 * El valor por defecto es `centered`: en móvil TODAS las ventanas emergentes
 * se presentan como la misma tarjeta centrada que la de acceso. Hoy ningún
 * modal declara `fullscreen`; se mantiene como opción explícita por si alguna
 * vista futura necesita de verdad ocupar la pantalla completa. Antes de
 * usarlo, ten en cuenta que la tarjeta centrada ya limita su altura y
 * desplaza el `<DialogBody>` por dentro, así que el contenido largo cabe.
 *
 * La geometría vive en `app/globals.css` bajo `.dialog-shell[data-mobile='…']`.
 */
type DialogMobileMode = "fullscreen" | "centered" | "none"

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "dialog-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-md",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    mobile?: DialogMobileMode
    hideClose?: boolean
  }
>(({ className, children, mobile = "centered", hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-mobile={mobile}
      className={cn(
        // La superficie (fondo, borde, radio, sombra) la aporta `.dialog-shell`
        // en globals.css, que comparte tokens con `<Card>` y con la tarjeta de
        // acceso. Aquí sólo queda el posicionamiento y el espaciado.
        "dialog-shell fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 p-8",
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="dialog-close absolute right-3 top-3 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none">
          <X className="h-[18px] w-[18px]" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Alineado a la izquierda también en móvil: centrar el encabezado va
      // contra el sesgo de lectura hacia la izquierda (NN/g, 2024) y, ahora
      // que `centered` es el modo por defecto, `text-center` habría pasado a
      // aplicarse a la mayoría de los modales. Además es como se alinea la
      // tarjeta de acceso.
      "dialog-header flex flex-col space-y-1.5 text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/**
 * Región desplazable del modal. Al usarla, en móvil el encabezado y el pie
 * quedan fijos y solo este bloque hace scroll. Si un modal no la usa, el
 * contenedor completo se desplaza (comportamiento de reserva).
 */
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("dialog-body", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "dialog-footer flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
