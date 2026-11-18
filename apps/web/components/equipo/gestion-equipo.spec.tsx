import type { Invitacion, Miembro, Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ProveedorSesion } from '@/components/panel/proveedor-sesion';
import { GestionEquipo } from './gestion-equipo';

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

const DUENO_USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USUARIO_ID = '22222222-2222-4222-8222-222222222222';
const PROF_USUARIO_ID = '33333333-3333-4333-8333-333333333333';
const MIEMBRO_ADMIN_ID = 'aaaa2222-2222-4222-8222-222222222222';
const MIEMBRO_PROF_ID = 'aaaa3333-3333-4333-8333-333333333333';
const INVITACION_ID = 'bbbb1111-1111-4111-8111-111111111111';

const miembrosEjemplo: Miembro[] = [
  {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    usuarioId: DUENO_USUARIO_ID,
    nombre: 'Camila Rojas',
    email: 'camila@estudio.cl',
    rol: 'dueno',
    activo: true,
    emailVerificado: true,
    creadoEn: '2026-11-01T12:00:00Z',
  },
  {
    id: MIEMBRO_ADMIN_ID,
    usuarioId: ADMIN_USUARIO_ID,
    nombre: 'Matías Silva',
    email: 'matias@estudio.cl',
    rol: 'admin',
    activo: true,
    emailVerificado: false,
    creadoEn: '2026-11-02T12:00:00Z',
  },
  {
    id: MIEMBRO_PROF_ID,
    usuarioId: PROF_USUARIO_ID,
    nombre: 'Sofía Pérez',
    email: 'sofia@estudio.cl',
    rol: 'profesional',
    activo: false,
    emailVerificado: true,
    creadoEn: '2026-11-03T12:00:00Z',
  },
];

const invitacionesEjemplo: Invitacion[] = [
  {
    id: INVITACION_ID,
    email: 'nuevo@estudio.cl',
    rol: 'recepcion',
    expiraEn: '2026-11-25T15:00:00Z',
    creadoEn: '2026-11-18T15:00:00Z',
  },
];

function crearSesion(rol: Sesion['rol'], usuarioId: string): Sesion {
  return {
    usuario: {
      id: usuarioId,
      nombre: 'Usuario Prueba',
      email: 'prueba@estudio.cl',
      emailVerificado: true,
    },
    empresa: {
      id: '99999999-9999-4999-8999-999999999999',
      nombre: 'Estudio Sur',
      slug: 'estudio-sur',
      zonaHoraria: 'America/Santiago',
      moneda: 'CLP',
    },
    rol,
  };
}

function renderGestion(sesion: Sesion) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProveedorSesion sesionInicial={sesion}>
        <GestionEquipo />
      </ProveedorSesion>
    </QueryClientProvider>,
  );
}

describe('GestionEquipo', () => {
  it('muestra los miembros y permite al dueño cambiar rol, activar/desactivar y eliminar con confirmación', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      if (input === '/api/v1/miembros' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(
          new Response(JSON.stringify(miembrosEjemplo), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/invitaciones' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(
          new Response(JSON.stringify(invitacionesEjemplo), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === `/api/v1/miembros/${MIEMBRO_ADMIN_ID}` && init?.method === 'PATCH') {
        return Promise.resolve(
          new Response(JSON.stringify({ ...miembrosEjemplo[1], activo: false }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === `/api/v1/miembros/${MIEMBRO_PROF_ID}` && init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderGestion(crearSesion('dueno', DUENO_USUARIO_ID));

    expect(await screen.findByText('Camila Rojas')).toBeInTheDocument();
    expect(screen.getByText('Matías Silva')).toBeInTheDocument();
    expect(screen.getByText('Sin verificar')).toBeInTheDocument();
    expect(screen.getByText('nuevo@estudio.cl')).toBeInTheDocument();

    // El dueño no puede eliminarse a sí mismo
    expect(screen.getByRole('button', { name: 'Eliminar a Camila Rojas' })).toBeDisabled();

    // Desactivar a Matías
    await usuario.click(screen.getByRole('switch', { name: 'Estado activo de Matías Silva' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/miembros/${MIEMBRO_ADMIN_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ activo: false }),
        }),
      ),
    );

    // Eliminar a Sofía con confirmación
    await usuario.click(screen.getByRole('button', { name: 'Eliminar a Sofía Pérez' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Sofía Pérez')).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/miembros/${MIEMBRO_PROF_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('permite invitar por correo y revocar invitaciones pendientes', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      if (input === '/api/v1/miembros') {
        return Promise.resolve(
          new Response(JSON.stringify(miembrosEjemplo), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/invitaciones' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(
          new Response(JSON.stringify(invitacionesEjemplo), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      if (input === '/api/v1/invitaciones' && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'cccc1111-1111-4111-8111-111111111111',
              email: 'ana@estudio.cl',
              rol: 'profesional',
              expiraEn: '2026-11-25T15:00:00Z',
              creadoEn: '2026-11-18T15:00:00Z',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderGestion(crearSesion('dueno', DUENO_USUARIO_ID));

    expect(await screen.findByText('nuevo@estudio.cl')).toBeInTheDocument();

    // Enviar formulario vacío muestra error de validación
    await usuario.click(screen.getByRole('button', { name: 'Enviar invitación' }));
    expect(await screen.findByText('Correo electrónico inválido')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'ana@estudio.cl');
    await usuario.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/invitaciones',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'ana@estudio.cl', rol: 'profesional' }),
        }),
      ),
    );

    // Revocar invitación existente
    await usuario.click(screen.getByRole('button', { name: 'Revocar' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/invitaciones/${INVITACION_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('impide al admin editar al dueño y oculta acciones administrativas a profesional', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      if (input === '/api/v1/invitaciones') {
        return Promise.resolve(
          new Response(JSON.stringify(invitacionesEjemplo), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(miembrosEjemplo), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchFalso);

    const { unmount } = renderGestion(crearSesion('admin', ADMIN_USUARIO_ID));
    expect(await screen.findByText('Camila Rojas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar a Camila Rojas' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar a Sofía Pérez' })).toBeEnabled();
    unmount();

    renderGestion(crearSesion('profesional', PROF_USUARIO_ID));
    expect(await screen.findByText('Camila Rojas')).toBeInTheDocument();
    expect(screen.queryByText('Invitar miembro')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument();
  });
});
