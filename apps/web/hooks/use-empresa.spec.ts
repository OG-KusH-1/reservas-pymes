import type { Empresa } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { simularFetch } from '@/test/utilidades';
import { CLAVE_EMPRESA, useActualizarEmpresa, useEmpresa } from './use-empresa';

const empresaEjemplo: Empresa = {
  id: '22222222-2222-4222-8222-222222222222',
  nombre: 'Peluquería Sur',
  slug: 'peluqueria-sur',
  rut: '76.123.456-7',
  email: 'hola@peluqueriasur.cl',
  telefono: '+56 9 1234 5678',
  direccion: 'Av. Providencia 100',
  zonaHoraria: 'America/Santiago',
  moneda: 'CLP',
  anticipacionMinimaMinutos: 60,
  anticipacionMaximaDias: 60,
  cancelacionMinimaMinutos: 120,
  intervaloGrillaMinutos: 15,
  confirmacionAutomatica: true,
  recordatorioHorasAntes: 24,
  creadoEn: '2026-11-10T12:00:00.000Z',
  actualizadoEn: '2026-11-10T12:00:00.000Z',
};

function crearWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useEmpresa y useActualizarEmpresa', () => {
  it('consulta GET /empresa y valida la respuesta con empresaSchema', async () => {
    const fetchFalso = simularFetch(200, empresaEjemplo);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const { result } = renderHook(() => useEmpresa(), {
      wrapper: crearWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(empresaEjemplo);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/empresa',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('actualiza la caché de empresa e invalida la sesión tras PATCH /empresa exitoso', async () => {
    const actualizada: Empresa = {
      ...empresaEjemplo,
      nombre: 'Peluquería Norte',
      slug: 'peluqueria-norte',
    };
    const fetchFalso = simularFetch(200, actualizada);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useActualizarEmpresa(), {
      wrapper: crearWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        nombre: 'Peluquería Norte',
        slug: 'peluqueria-norte',
      });
    });

    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/empresa',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          nombre: 'Peluquería Norte',
          slug: 'peluqueria-norte',
        }),
      }),
    );
    expect(queryClient.getQueryData(CLAVE_EMPRESA)).toEqual(actualizada);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CLAVE_SESION });
  });
});
