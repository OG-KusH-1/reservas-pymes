import type { Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AvisoVerificacion } from './aviso-verificacion';
import { ProveedorSesion } from './proveedor-sesion';

const sesionBase: Sesion = {
  usuario: {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Camila Rojas',
    email: 'camila@estudio.cl',
    emailVerificado: false,
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

function renderAviso(sesion: Sesion) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProveedorSesion sesionInicial={sesion}>
        <AvisoVerificacion />
      </ProveedorSesion>
    </QueryClientProvider>,
  );
}

describe('AvisoVerificacion', () => {
  it('no se muestra cuando el correo ya está verificado', () => {
    renderAviso({
      ...sesionBase,
      usuario: { ...sesionBase.usuario, emailVerificado: true },
    });

    expect(
      screen.queryByText('Tu correo electrónico aún no está verificado'),
    ).not.toBeInTheDocument();
  });

  it('muestra el banner y permite reenviar el correo de verificación', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderAviso(sesionBase);

    expect(screen.getByText('Tu correo electrónico aún no está verificado')).toBeInTheDocument();
    expect(screen.getByText('camila@estudio.cl')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reenviar correo de verificación' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/auth/verificar-correo/enviar',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Reenviar nuevamente' })).toBeInTheDocument();
  });
});
