import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

/**
 * Un único modal para todos los breakpoints. La geometría y la anatomía viven
 * en `app/styles/modals.css` (`@layer components`), no en el JSX:
 *
 *  - Ancho: `100dvw` menos el margen lateral, con tope en el `size` elegido.
 *    En móvil y tableta el modal es fluido y crece hasta su tope sin saltos:
 *    antes una regla sólo para <1024px los encogía a 460px y en 1024 saltaban
 *    a 672/896px.
 *      sm  420px → confirmaciones y resultados
 *      md  480px → formularios de una columna (POR DEFECTO)
 *      lg  560px → formularios a dos columnas o detalle con más aire
 *      xl  720px → tablas de datos, gráficos, buscador
 *      2xl 960px → vistas de consulta con filtros y listados largos
 *  - Alto: como mucho `100dvh` menos el margen vertical, con tope en 900px.
 *  - Anatomía: `<DialogHeader>` y `<DialogFooter>` quedan fijos y sólo
 *    `<DialogBody>` se desplaza. Todo modal debe envolver su contenido en
 *    `<DialogBody>`; si no lo hace, se desplaza la tarjeta entera (reserva).
 *
 * Como esas reglas van en una capa, cualquier utilidad de Tailwind les gana:
 * NO pases `max-w-*`, `max-h-*`, `p-*`, `overflow-*` ni `flex` a
 * `DialogContent`, `DialogHeader`, `DialogBody` ni `DialogFooter`. Elige un
 * `size` y deja que el sistema haga el resto.
 *
 * `mobile` decide la presentación por debajo de 1024px:
 *  - `centered`: la especificación unificada de arriba (POR DEFECTO).
 *  - `fullscreen`: ocupa toda la pantalla como una vista nativa, con la misma
 *    anatomía. Hoy nadie lo usa; queda como opción explícita, pero la tarjeta
 *    centrada ya limita su altura y desplaza el cuerpo, así que el contenido
 *    largo cabe sin él.
 *  - `none`: sin geometría ni anatomía compartidas; el modal aporta todo su
 *    diseño. Hoy sólo lo usa el panel de módulos del dashboard (media
 *    pantalla, estilado en `dashboard-system.css`).
 *
 * El botón de cierre mide 44×44 y va a 12px de la esquina; la cabecera le
 * reserva siempre su hueco (64px). Velo y capa (`--dialog-scrim`,
 * `--z-overlay`) salen de `tokens.css`.
 */
type DialogMobileMode = "fullscreen" | "centered" | "none"

type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl"

/**
 * Devuelve el foco al cerrar al elemento que lo tenía al abrir.
 *
 * Radix sólo lo devuelve a un `<DialogTrigger>`, y casi todos los modales de
 * la aplicación se abren controlados (`open`) desde botones, tarjetas o menús
 * sin trigger: el foco caía en `<body>` y quien navega con teclado o lector
 * de pantalla perdía su sitio. Al montar, el `FocusScope` de Radix dispara
 * `onOpenAutoFocus` ANTES de mover el foco, así que `document.activeElement`
 * todavía es el control que abrió el modal.
 *
 * `fallback` cubre el caso de un menú: el elemento enfocado era una opción
 * del desplegable que ya no existe al cerrar, y el sitio lógico es el botón
 * que abre ese menú.
 */
function useDialogReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
  fallback,
}: {
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
  fallback?: () => HTMLElement | null | undefined
} = {}) {
  const returnFocusRef = React.useRef<HTMLElement | null>(null)

  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement
      returnFocusRef.current =
        active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const saved = returnFocusRef.current
      returnFocusRef.current = null
      const target = saved?.isConnected ? saved : fallback?.()
      if (target?.isConnected) {
        // Se previene el comportamiento de Radix (enfocar un trigger que aquí
        // no existe) y se enfoca el control de origen.
        event.preventDefault()
        target.focus()
      }
    },
  }
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Velo y capa salen de tokens.css (`--dialog-scrim`, `--z-overlay`): el
      // panel de módulo y el cajón de usuarios usan exactamente los mismos.
      "dialog-overlay fixed inset-0 z-(--z-overlay) bg-(--dialog-scrim)",
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
    size?: DialogSize
    hideClose?: boolean
    overlayClassName?: string
  }
>(({ className, children, mobile = "centered", size = "md", hideClose = false, overlayClassName, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const returnFocus = useDialogReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        onOpenAutoFocus={returnFocus.onOpenAutoFocus}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        data-mobile={mobile}
        // Con `none` el modal no usa la geometría compartida: un `data-size`
        // ahí sólo confundiría al leer el DOM.
        data-size={mobile === "none" ? undefined : size}
        className={cn(
          // La superficie (fondo, borde, radio, sombra) la aporta `.dialog-shell`
          // en las hojas de estilo, que comparte tokens con `<Card>` y con la
          // tarjeta de acceso; ancho, alto, relleno y desplazamiento los aporta
          // `modals.css`. Aquí sólo queda el posicionamiento: cualquier utilidad
          // de tamaño o espaciado ganaría a la capa y rompería la especificación.
          "dialog-shell fixed left-1/2 top-1/2 z-(--z-overlay) -translate-x-1/2 -translate-y-1/2",
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          // 44×44 con cualquier puntero (WCAG 2.5.8 con margen) y nombre
          // accesible en `aria-label`: con un <span class="sr-only"> el botón
          // no tenía `aria-label` y la regla táctil de 44px de alto lo
          // deformaba en una píldora de 40×44.
          <DialogPrimitive.Close
            aria-label="Cerrar"
            className="dialog-close absolute right-3 top-3 ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="size-4.5" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * Cabecera fija del modal. Por defecto va alineada a la izquierda, también en
 * móvil: centrar el encabezado va contra el sesgo de lectura hacia la
 * izquierda (NN/g, 2024) y es como se alinea la tarjeta de acceso.
 *
 * `align="center"` es para las cabeceras de resultado o confirmación con un
 * icono de estado encima del título. Reserva el hueco del botón de cierre a
 * AMBOS lados: con el hueco sólo a la derecha el eje del contenido quedaba
 * ~30px a la izquierda del eje del modal.
 */
const DialogHeader = ({
  className,
  align = "start",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" }) => (
  <div
    data-align={align === "center" ? "center" : undefined}
    className={cn(
      "dialog-header flex flex-col space-y-1.5",
      align === "center" ? "items-center text-center" : "text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

/**
 * Región desplazable del modal. El encabezado y el pie quedan fijos en todos
 * los breakpoints y sólo este bloque hace scroll. Si un modal no la usa, el
 * contenedor completo se desplaza (comportamiento de reserva) y la cabecera
 * con el botón de cierre se va con él, así que úsala siempre.
 *
 * Es un contenedor de consultas (`container-type: inline-size`, declarado en
 * `modals.css` para que no alcance al panel de módulo): dentro, las rejillas
 * usan variantes de contenedor (`@sm:grid-cols-2`) y no de viewport. Un
 * `md:grid-cols-2` mira la ventana, no el modal, y en una tableta partía en
 * dos columnas un cuerpo de 400px.
 *
 * Formularios: el `<form>` va DENTRO del cuerpo con un `id`, y el botón de
 * envío en `<DialogFooter>` con `type="submit" form={id}`. El envío con Intro
 * y la validación nativa (`required`) siguen funcionando.
 */
const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("dialog-body", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

/**
 * Acciones del modal. Por debajo de 640px se apilan a todo el ancho con la
 * principal (la última del DOM) arriba; desde 640px van en fila alineadas a
 * la derecha. La separación es `gap`, no `space-x`: con `space-x` los botones
 * apilados quedaban pegados.
 */
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("dialog-footer", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // `leading-tight`, no `leading-none`: con el hueco del botón de cierre
      // los títulos largos parten en dos líneas en móvil y se montaban.
      "text-lg font-semibold leading-tight tracking-tight",
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
  useDialogReturnFocus,
}
