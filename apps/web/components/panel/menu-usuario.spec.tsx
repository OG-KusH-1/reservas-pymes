import type { Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { MenuUsuario } from './menu-usuario';
import { ProveedorSesion } from './proveedor-sesion';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

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

describe('MenuUsuario', () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it('muestra datos del usuario y al cerrar sesión llama a POST /auth/salir, limpia la caché y redirige a /ingresar', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['datos-empresa'], { prueba: true });

    render(
      <QueryClientProvider client={queryClient}>
        <ProveedorSesion sesionInicial={sesionEjemplo}>
          <MenuUsuario />
        </ProveedorSesion>
      </QueryClientProvider>,
    );

    expect(queryClient.getQueryData(CLAVE_SESION)).toEqual(sesionEjemplo);

    await usuario.click(screen.getByRole('button', { name: 'Menú de usuario de Camila Rojas' }));

    expect(await screen.findByText('camila@estudio.cl')).toBeInTheDocument();
    expect(screen.getByText('Estudio Sur')).toBeInTheDocument();

    await usuario.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/ingresar'));
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/auth/salir',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(queryClient.getQueryData(CLAVE_SESION)).toBeUndefined();
    expect(queryClient.getQueryData(['datos-empresa'])).toBeUndefined();
  });
});
