import type { PaginaServicios, Servicio } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { simularFetch } from '@/test/utilidades';
import {
  CLAVE_SERVICIOS,
  useActualizarServicio,
  useCrearServicio,
  useEliminarServicio,
  useServicios,
} from './use-servicios';

const SERVICIO_ID = '11111111-1111-4111-8111-111111111111';

const servicioEjemplo: Servicio = {
  id: SERVICIO_ID,
  nombre: 'Corte clásico',
  descripcion: 'Incluye lavado',
  categoria: 'Peluquería',
  duracionMinutos: 45,
  margenPosteriorMinutos: 10,
  precio: 15000,
  visiblePublico: true,
  color: '#2563EB',
  activo: true,
  creadoEn: '2026-11-10T12:00:00.000Z',
  actualizadoEn: '2026-11-10T12:00:00.000Z',
};

function crearWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function crearQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

describe('hooks de servicios', () => {
  it('useServicios consulta GET /servicios con filtros y pagina con cursor', async () => {
    const pagina1: PaginaServicios = {
      datos: [servicioEjemplo],
      siguienteCursor: 'cursor-2',
    };
    const pagina2: PaginaServicios = {
      datos: [{ ...servicioEjemplo, id: '22222222-2222-4222-8222-222222222222', nombre: 'Barba' }],
      siguienteCursor: null,
    };

    const fetchFalso = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pagina1), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pagina2), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchFalso);

    const queryClient = crearQueryClient();
    const { result } = renderHook(
      () => useServicios({ activo: true, categoria: 'Peluquería', q: 'corte' }),
      { wrapper: crearWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchFalso).toHaveBeenNthCalledWith(
      1,
      '/api/v1/servicios?activo=true&categoria=Peluquer%C3%ADa&q=corte',
      expect.objectContaining({ method: 'GET' }),
    );

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchFalso).toHaveBeenNthCalledWith(
      2,
      '/api/v1/servicios?activo=true&categoria=Peluquer%C3%ADa&q=corte&cursor=cursor-2',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('useCrearServicio envía POST /servicios e invalida CLAVE_SERVICIOS', async () => {
    const fetchFalso = simularFetch(201, servicioEjemplo);
    const queryClient = crearQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCrearServicio(), {
      wrapper: crearWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        nombre: 'Corte clásico',
        descripcion: 'Incluye lavado',
        categoria: 'Peluquería',
        duracionMinutos: 45,
        margenPosteriorMinutos: 10,
        precio: 15000,
        visiblePublico: true,
        color: '#2563EB',
        activo: true,
      });
    });

    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/servicios',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CLAVE_SERVICIOS });
  });

  it('useActualizarServicio envía PATCH /servicios/:id e invalida CLAVE_SERVICIOS', async () => {
    const actualizado: Servicio = { ...servicioEjemplo, activo: false };
    const fetchFalso = simularFetch(200, actualizado);
    const queryClient = crearQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useActualizarServicio(), {
      wrapper: crearWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: SERVICIO_ID, datos: { activo: false } });
    });

    expect(fetchFalso).toHaveBeenCalledWith(
      `/api/v1/servicios/${SERVICIO_ID}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ activo: false }),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CLAVE_SERVICIOS });
  });

  it('useEliminarServicio envía DELETE /servicios/:id e invalida CLAVE_SERVICIOS', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const queryClient = crearQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useEliminarServicio(), {
      wrapper: crearWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync(SERVICIO_ID);
    });

    expect(fetchFalso).toHaveBeenCalledWith(
      `/api/v1/servicios/${SERVICIO_ID}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CLAVE_SERVICIOS });
  });
});
