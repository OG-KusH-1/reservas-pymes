import type { EmpresaDeUsuario, Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { MenuUsuario } from './menu-usuario';
import { ProveedorSesion } from './proveedor-sesion';

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

const EMPRESA_1_ID = '22222222-2222-4222-8222-222222222222';
const EMPRESA_2_ID = '33333333-3333-4333-8333-333333333333';

const sesionEjemplo: Sesion = {
  usuario: {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Camila Rojas',
    email: 'camila@estudio.cl',
    emailVerificado: true,
  },
  empresa: {
    id: EMPRESA_1_ID,
    nombre: 'Estudio Sur',
    slug: 'estudio-sur',
    zonaHoraria: 'America/Santiago',
    moneda: 'CLP',
  },
  rol: 'dueno',
};

const empresasMultiples: EmpresaDeUsuario[] = [
  {
    id: EMPRESA_1_ID,
    nombre: 'Estudio Sur',
    slug: 'estudio-sur',
    rol: 'dueno',
    activa: true,
  },
  {
    id: EMPRESA_2_ID,
    nombre: 'Clínica Norte',
    slug: 'clinica-norte',
    rol: 'admin',
    activa: false,
  },
];

describe('MenuUsuario', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  it('muestra datos del usuario y al cerrar sesión llama a POST /auth/salir, limpia la caché y redirige a /ingresar', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      if (input === '/api/v1/auth/empresas') {
        return Promise.resolve(
          new Response(JSON.stringify([empresasMultiples[0]]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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
    expect(screen.queryByText('Empresas')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/ingresar'));
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/auth/salir',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(queryClient.getQueryData(CLAVE_SESION)).toBeUndefined();
    expect(queryClient.getQueryData(['datos-empresa'])).toBeUndefined();
  });

  it('muestra el selector cuando el usuario pertenece a más de una empresa y cambia la empresa activa', async () => {
    const nuevaSesion: Sesion = {
      ...sesionEjemplo,
      empresa: {
        id: EMPRESA_2_ID,
        nombre: 'Clínica Norte',
        slug: 'clinica-norte',
        zonaHoraria: 'America/Santiago',
        moneda: 'CLP',
      },
      rol: 'admin',
    };

    const fetchFalso = vi.fn<typeof fetch>((input) => {
      if (input === '/api/v1/auth/empresas') {
        return Promise.resolve(
          new Response(JSON.stringify(empresasMultiples), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/auth/empresa-activa') {
        return Promise.resolve(
          new Response(JSON.stringify(nuevaSesion), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ProveedorSesion sesionInicial={sesionEjemplo}>
          <MenuUsuario />
        </ProveedorSesion>
      </QueryClientProvider>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Menú de usuario de Camila Rojas' }));

    expect(await screen.findByText('Empresas')).toBeInTheDocument();
    const itemClinica = screen.getByRole('menuitem', { name: /Clínica Norte/i });
    await usuario.click(itemClinica);

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/auth/empresa-activa',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ empresaId: EMPRESA_2_ID }),
      }),
    );
    expect(queryClient.getQueryData(CLAVE_SESION)).toEqual(nuevaSesion);
  });
});
