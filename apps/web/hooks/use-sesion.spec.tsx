import type { Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { simularFetch } from '@/test/utilidades';
import {
  CLAVE_SESION,
  useCerrarSesion,
  useIniciarSesion,
  useRegistro,
  useSesion,
} from './use-sesion';

const sesionEjemplo: Sesion = {
  usuario: {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Camila Rojas',
    email: 'camila@estudio.cl',
    emailVerificado: true,
  },
  empresa: {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Estudio Sur',
    slug: 'estudio-sur',
    zonaHoraria: 'America/Santiago',
    moneda: 'CLP',
  },
  rol: 'dueno',
};

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

describe('useSesion', () => {
  it('devuelve null cuando la API responde 401 sin considerarlo un error', async () => {
    simularFetch(401, { codigo: 'NO_AUTENTICADO', mensaje: 'No has iniciado sesión' });
    const { Wrapper } = crearWrapper();

    const { result } = renderHook(() => useSesion(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('devuelve la sesión cuando la API responde 200', async () => {
    const fetchFalso = simularFetch(200, sesionEjemplo);
    const { Wrapper } = crearWrapper();

    const { result } = renderHook(() => useSesion(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sesionEjemplo);
    expect(fetchFalso).toHaveBeenCalledWith('/api/v1/auth/sesion', expect.anything());
  });

  it('propaga errores distintos de 401', async () => {
    simularFetch(500, { codigo: 'INTERNO', mensaje: 'Fallo interno' });
    const { Wrapper } = crearWrapper();

    const { result } = renderHook(() => useSesion(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Fallo interno');
  });
});

describe('mutaciones de sesión', () => {
  it('useIniciarSesion guarda la sesión en la caché al tener éxito', async () => {
    simularFetch(200, sesionEjemplo);
    const { queryClient, Wrapper } = crearWrapper();

    const { result } = renderHook(() => useIniciarSesion(), { wrapper: Wrapper });

    await result.current.mutateAsync({ email: 'camila@estudio.cl', password: 'clave-larga-123' });

    expect(queryClient.getQueryData(CLAVE_SESION)).toEqual(sesionEjemplo);
  });

  it('useRegistro guarda la sesión en la caché al tener éxito', async () => {
    simularFetch(201, sesionEjemplo);
    const { queryClient, Wrapper } = crearWrapper();

    const { result } = renderHook(() => useRegistro(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      nombreEmpresa: 'Estudio Sur',
      slug: 'estudio-sur',
      nombre: 'Camila Rojas',
      email: 'camila@estudio.cl',
      password: 'clave-larga-123',
    });

    expect(queryClient.getQueryData(CLAVE_SESION)).toEqual(sesionEjemplo);
  });

  it('useCerrarSesion vacía toda la caché de TanStack Query al tener éxito', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);

    const { queryClient, Wrapper } = crearWrapper();
    queryClient.setQueryData(CLAVE_SESION, sesionEjemplo);
    queryClient.setQueryData(['servicios'], [{ id: '1' }]);

    const { result } = renderHook(() => useCerrarSesion(), { wrapper: Wrapper });

    await result.current.mutateAsync();

    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/auth/salir',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(queryClient.getQueryData(CLAVE_SESION)).toBeUndefined();
    expect(queryClient.getQueryData(['servicios'])).toBeUndefined();
  });
});
