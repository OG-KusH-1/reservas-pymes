import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Renderiza un componente con los proveedores que necesita para funcionar
 * fuera de la aplicación (hoy, TanStack Query).
 *
 * Cada llamada crea un `QueryClient` nuevo, sin reintentos ni caché, para que
 * las pruebas sean rápidas y no compartan datos entre sí.
 */
export function renderConProveedores(ui: React.ReactElement, opciones?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, opciones);
}

/**
 * Sustituye `fetch` por un doble que responde JSON con el estado indicado.
 * Devuelve el doble para poder verificar con qué se llamó.
 *
 * @example
 * const fetchFalso = simularFetch(200, { status: 'ok' });
 * expect(fetchFalso).toHaveBeenCalledWith('/api/v1/health', expect.anything());
 */
export function simularFetch(estado: number, cuerpo: unknown) {
  const doble = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', doble);
  return doble;
}
