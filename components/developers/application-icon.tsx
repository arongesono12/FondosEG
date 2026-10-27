'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Image as ImageIcon, Trash2 } from '@/components/ui/hugeicons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ApplicationIconSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<ApplicationIconSize, string> = {
  sm: 'h-9 w-9 rounded-xl text-xs',
  md: 'h-12 w-12 rounded-2xl text-sm',
  lg: 'h-16 w-16 rounded-2xl text-lg',
};

// Sin icono, el color sale del nombre: la misma app siempre se ve igual.
const FALLBACK_TONES = [
  'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`;
  return letters.toUpperCase();
}

function toneOf(name: string): string {
  const hash = Array.from(name).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}

interface ApplicationIconProps {
  name: string;
  iconUrl?: string | null;
  size?: ApplicationIconSize;
  className?: string;
}

export function ApplicationIcon({ name, iconUrl, size = 'md', className }: ApplicationIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(iconUrl) && failedUrl !== iconUrl;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold ring-1 ring-inset ring-border',
        SIZE_CLASSES[size],
        showImage ? 'bg-background' : toneOf(name),
        className
      )}
    >
      {showImage ? (
        // `<img>` como el avatar del perfil: la vista previa es un `blob:` y el
        // icono ya llega a 256 px, no hay nada que optimizar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedUrl(iconUrl ?? null)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

const ICON_SIZE_PX = 256;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_ICON_TYPES = 'image/png,image/jpeg,image/webp';

/**
 * Recorta al centro y reduce a 256×256 PNG antes de subir: la foto original
 * puede pesar varios MB y llevar metadatos (EXIF, ubicación) que no deben
 * publicarse. El servidor vuelve a validar el resultado.
 */
export async function normalizeApplicationIcon(file: File): Promise<Blob> {
  if (!ACCEPTED_ICON_TYPES.split(',').includes(file.type)) {
    throw new Error('El icono debe ser una imagen PNG, JPG o WebP.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('La imagen no debe superar los 5 MB.');
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('No se pudo leer la imagen.');
  });

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE_PX;
    canvas.height = ICON_SIZE_PX;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo procesar la imagen.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      ICON_SIZE_PX,
      ICON_SIZE_PX
    );
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'))), 'image/png');
    });
  } finally {
    bitmap.close();
  }
}

interface ApplicationIconPickerProps {
  name: string;
  /** Icono guardado; se muestra mientras no se elija otro. */
  currentUrl?: string | null;
  /** Blob listo para subir, o `null` si se quitó el icono. */
  value: Blob | null | undefined;
  onChange: (value: Blob | null) => void;
  /** Mientras se procesa la imagen el formulario no debe enviarse sin ella. */
  onProcessingChange?: (processing: boolean) => void;
  disabled?: boolean;
}

/**
 * `value === undefined`: sin cambios. `null`: quitar el icono. Blob: icono
 * nuevo ya normalizado.
 */
export function ApplicationIconPicker({
  name,
  currentUrl,
  value,
  onChange,
  onProcessingChange,
  disabled,
}: ApplicationIconPickerProps) {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessingState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setProcessing(next: boolean) {
    setProcessingState(next);
    onProcessingChange?.(next);
  }

  useEffect(() => {
    if (!(value instanceof Blob)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      onChange(await normalizeApplicationIcon(file));
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : 'No se pudo leer la imagen.');
    } finally {
      setProcessing(false);
    }
  }

  const shownUrl = value === undefined ? currentUrl : previewUrl;
  const hasIcon = Boolean(shownUrl);

  return (
    <div className="space-y-1.5" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-sm font-medium">
        Icono <span className="font-normal text-muted-foreground">(opcional)</span>
      </span>
      <div className="flex items-center gap-4">
        <ApplicationIcon name={name || '?'} iconUrl={shownUrl} size="lg" />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || processing}
              onClick={() => inputRef.current?.click()}
            >
              <ImageIcon /> {processing ? 'Procesando…' : hasIcon ? 'Cambiar' : 'Subir icono'}
            </Button>
            {hasIcon && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={disabled || processing}
                onClick={() => onChange(null)}
              >
                <Trash2 /> Quitar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG o WebP cuadrado. Se ajusta a 256×256.</p>
        </div>
        {/* El control real es el botón; el input solo abre el selector. */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_ICON_TYPES}
          hidden
          disabled={disabled || processing}
          onChange={handleFile}
        />
      </div>
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}
