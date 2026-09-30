'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError } from '@/services/http';

export type RemoteStatus = 'loading' | 'ready' | 'error';

export interface RemoteBlock<T> {
  status: RemoteStatus;
  /** Último dato válido; se conserva durante un reintento o tras un error posterior. */
  data: T | null;
  updatedAt: Date | null;
  reload: () => void;
}

/**
 * Carga un bloque de datos de forma independiente: el fallo de un bloque no
 * vacía los demás ni se confunde con un valor cero. `key` a null desactiva la
 * carga (por ejemplo, un bloque que no corresponde al rol actual); cambiarlo
 * vuelve a cargar. Las respuestas que llegan tarde se descartan.
 */
export function useRemoteBlock<T>(key: string | null, load: () => Promise<T>, label: string): RemoteBlock<T> {
  const [state, setState] = useState<Omit<RemoteBlock<T>, 'reload'>>({ status: 'loading', data: null, updatedAt: null });
  const loadRef = useRef(load);
  const requestId = useRef(0);
  loadRef.current = load;

  const run = useCallback(() => {
    if (key === null) return;
    const id = ++requestId.current;
    setState((previous) => ({ ...previous, status: 'loading' }));
    loadRef.current().then(
      (data) => {
        if (id === requestId.current) setState({ status: 'ready', data, updatedAt: new Date() });
      },
      (error: unknown) => {
        if (id !== requestId.current) return;
        if (!(error instanceof HttpError && error.status === 401)) console.error(`Error loading ${label}:`, error);
        setState((previous) => ({ ...previous, status: 'error' }));
      },
    );
  }, [key, label]);

  useEffect(() => {
    run();
    return () => { requestId.current++; };
  }, [run]);

  return { ...state, reload: run };
}
