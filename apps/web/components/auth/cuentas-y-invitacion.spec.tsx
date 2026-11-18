import type { DetalleInvitacionPublica, Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { AceptarInvitacion } from './aceptar-invitacion';
import { EstadoVerificacion } from './estado-verificacion';
import { FormularioRecuperar } from './formulario-recuperar';
import { FormularioRestablecer } from './formulario-restablecer';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

function conQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

describe('FormularioRecuperar', () => {
  it('valida el correo y muestra una confirmación neutra al enviar', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    conQueryClient(<FormularioRecuperar />);

    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));
    expect(await screen.findByText('Correo electrónico inválido')).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/publico/recuperar',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'camila@estudio.cl' }),
        }),
      ),
    );
    expect(
      await screen.findByText(/Si existe una cuenta asociada a ese correo/),
    ).toBeInTheDocument();
  });
});

describe('FormularioRestablecer', () => {
  it('muestra enlace inválido cuando falta el token', () => {
    conQueryClient(<FormularioRestablecer token="" />);
    expect(screen.getByText('Enlace inválido o incompleto')).toBeInTheDocument();
  });

  it('valida la nueva contraseña, llama a POST /publico/restablecer y ofrece ir a ingresar', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    conQueryClient(<FormularioRestablecer token="tok-123" />);

    await usuario.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));
    expect(await screen.findByText('Debe tener al menos 10 caracteres')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Nueva contraseña'), 'nuevaClaveSegura123');
    await usuario.click(screen.getByRole('button', { name: 'Guardar nueva contraseña' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/publico/restablecer',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'tok-123', password: 'nuevaClaveSegura123' }),
        }),
      ),
    );
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
  });
});

describe('EstadoVerificacion', () => {
  it('verifica el correo una sola vez incluso en StrictMode y muestra confirmación', async () => {
    const fetchFalso = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal('fetch', fetchFalso);

    conQueryClient(
      <StrictMode>
        <EstadoVerificacion token="verif-123" />
      </StrictMode>,
    );

    expect(await screen.findByText('Correo verificado')).toBeInTheDocument();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/publico/verificar-correo',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'verif-123' }),
      }),
    );
  });
});

describe('AceptarInvitacion', () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  const detalleNuevo: DetalleInvitacionPublica = {
    email: 'nueva@estudio.cl',
    rol: 'profesional',
    empresaNombre: 'Estudio Sur',
    usuarioExiste: false,
    expiraEn: '2026-11-25T15:00:00Z',
  };

  const sesionResultante: Sesion = {
    usuario: {
      id: '11111111-1111-4111-8111-111111111111',
      nombre: 'Nueva Profesional',
      email: 'nueva@estudio.cl',
      emailVerificado: true,
    },
    empresa: {
      id: '22222222-2222-4222-8222-222222222222',
      nombre: 'Estudio Sur',
      slug: 'estudio-sur',
      zonaHoraria: 'America/Santiago',
      moneda: 'CLP',
    },
    rol: 'profesional',
  };

  it('crea cuenta y acepta la invitación cuando usuarioExiste es false', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      if (input === '/api/v1/publico/invitaciones/inv-1') {
        return Promise.resolve(
          new Response(JSON.stringify(detalleNuevo), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/auth/sesion') {
        return Promise.resolve(
          new Response(JSON.stringify({ codigo: 'NO_AUTENTICADO', mensaje: 'Sin sesión' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/publico/invitaciones/inv-1/aceptar') {
        return Promise.resolve(
          new Response(JSON.stringify(sesionResultante), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    const { queryClient } = conQueryClient(<AceptarInvitacion token="inv-1" />);

    expect(await screen.findByText('Estudio Sur')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Tu nombre'), 'Nueva Profesional');
    await usuario.type(screen.getByLabelText('Contraseña'), 'claveSegura123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta y aceptar' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
    expect(queryClient.getQueryData(CLAVE_SESION)).toEqual(sesionResultante);
  });

  it('pide iniciar sesión si usuarioExiste es true y no hay sesión con ese correo', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      if (input === '/api/v1/publico/invitaciones/inv-2') {
        return Promise.resolve(
          new Response(JSON.stringify({ ...detalleNuevo, usuarioExiste: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ codigo: 'NO_AUTENTICADO', mensaje: 'Sin sesión' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchFalso);

    conQueryClient(<AceptarInvitacion token="inv-2" />);

    const enlace = await screen.findByRole('link', { name: 'Iniciar sesión para aceptar' });
    expect(enlace).toHaveAttribute('href', '/ingresar?siguiente=%2Finvitacion%3Ftoken%3Dinv-2');
  });

  it('permite aceptar directamente si usuarioExiste es true y coincide la sesión activa', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      if (input === '/api/v1/publico/invitaciones/inv-3') {
        return Promise.resolve(
          new Response(JSON.stringify({ ...detalleNuevo, usuarioExiste: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/auth/sesion') {
        return Promise.resolve(
          new Response(JSON.stringify(sesionResultante), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/publico/invitaciones/inv-3/aceptar') {
        return Promise.resolve(
          new Response(JSON.stringify(sesionResultante), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    conQueryClient(<AceptarInvitacion token="inv-3" />);

    const boton = await screen.findByRole('button', { name: 'Aceptar invitación' });
    await usuario.click(boton);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/publico/invitaciones/inv-3/aceptar',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });
});
