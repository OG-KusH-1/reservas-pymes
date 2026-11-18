import type {
  Miembro,
  PaginaProfesionales,
  Profesional,
  Servicio,
  Sesion,
} from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ProveedorSesion } from '@/components/panel/proveedor-sesion';
import { GestionProfesionales } from './gestion-profesionales';

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const DUENO_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const SERVICIO_CORTE_ID = 'aaaa1111-1111-4111-8111-111111111111';
const SERVICIO_COLOR_ID = 'aaaa2222-2222-4222-8222-222222222222';
const PROF_1_ID = 'bbbb1111-1111-4111-8111-111111111111';
const PROF_2_ID = 'bbbb2222-2222-4222-8222-222222222222';

const serviciosEjemplo: Servicio[] = [
  {
    id: SERVICIO_CORTE_ID,
    nombre: 'Corte clásico',
    descripcion: null,
    categoria: 'Cabello',
    duracionMinutos: 30,
    margenPosteriorMinutos: 0,
    precio: 15000,
    visiblePublico: true,
    color: '#2563eb',
    activo: true,
    creadoEn: '2026-11-01T12:00:00Z',
    actualizadoEn: '2026-11-01T12:00:00Z',
  },
  {
    id: SERVICIO_COLOR_ID,
    nombre: 'Coloración',
    descripcion: null,
    categoria: 'Cabello',
    duracionMinutos: 90,
    margenPosteriorMinutos: 15,
    precio: 45000,
    visiblePublico: true,
    color: '#db2777',
    activo: true,
    creadoEn: '2026-11-01T12:00:00Z',
    actualizadoEn: '2026-11-01T12:00:00Z',
  },
];

const miembrosEjemplo: Miembro[] = [
  {
    id: 'cccc1111-1111-4111-8111-111111111111',
    usuarioId: DUENO_ID,
    nombre: 'Camila Rojas',
    email: 'camila@estudio.cl',
    rol: 'dueno',
    activo: true,
    emailVerificado: true,
    creadoEn: '2026-11-01T12:00:00Z',
  },
  {
    id: 'cccc2222-2222-4222-8222-222222222222',
    usuarioId: ADMIN_ID,
    nombre: 'Matías Silva',
    email: 'matias@estudio.cl',
    rol: 'admin',
    activo: true,
    emailVerificado: true,
    creadoEn: '2026-11-02T12:00:00Z',
  },
];

const profesional1: Profesional = {
  id: PROF_1_ID,
  usuarioId: DUENO_ID,
  nombre: 'Valentina Soto',
  email: 'valentina@estudio.cl',
  telefono: '+56 9 1111 2222',
  activo: true,
  servicios: [{ id: SERVICIO_CORTE_ID, nombre: 'Corte clásico', color: '#2563eb', activo: true }],
  creadoEn: '2026-11-01T12:00:00Z',
  actualizadoEn: '2026-11-01T12:00:00Z',
};

const profesional2: Profesional = {
  id: PROF_2_ID,
  usuarioId: null,
  nombre: 'Diego Morales',
  email: null,
  telefono: null,
  activo: false,
  servicios: [],
  creadoEn: '2026-11-02T12:00:00Z',
  actualizadoEn: '2026-11-02T12:00:00Z',
};

function crearSesion(rol: Sesion['rol']): Sesion {
  return {
    usuario: {
      id: DUENO_ID,
      nombre: 'Camila Rojas',
      email: 'camila@estudio.cl',
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

function respuestaJson(cuerpo: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function renderProfesionales(sesion: Sesion) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProveedorSesion sesionInicial={sesion}>
        <GestionProfesionales />
      </ProveedorSesion>
    </QueryClientProvider>,
  );
}

describe('GestionProfesionales', () => {
  it('lista profesionales paginados, permite cargar más y aplica filtros por texto, estado y servicio', async () => {
    const pagina1: PaginaProfesionales = {
      datos: [profesional1],
      siguienteCursor: 'cursor-2',
    };
    const pagina2: PaginaProfesionales = {
      datos: [profesional2],
      siguienteCursor: null,
    };

    const fetchFalso = vi.fn<typeof fetch>((input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/v1/servicios?limite=100') {
        return respuestaJson({ datos: serviciosEjemplo, siguienteCursor: null });
      }
      if (url === '/api/v1/miembros') {
        return respuestaJson(miembrosEjemplo);
      }
      if (url.startsWith('/api/v1/profesionales')) {
        if (url.includes('cursor=cursor-2')) {
          return respuestaJson(pagina2);
        }
        return respuestaJson(pagina1);
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderProfesionales(crearSesion('dueno'));

    expect(await screen.findByText('Valentina Soto')).toBeInTheDocument();
    expect(screen.getByText('Camila Rojas')).toBeInTheDocument();
    expect(screen.getByText('Corte clásico')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('Diego Morales')).toBeInTheDocument();

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar profesionales' }), 'Diego');
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/profesionales?q=Diego',
        expect.objectContaining({ credentials: 'include' }),
      ),
    );

    await usuario.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }));
    await usuario.click(screen.getByRole('option', { name: 'Activos' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/profesionales?activo=true&q=Diego',
        expect.objectContaining({ credentials: 'include' }),
      ),
    );

    await usuario.click(screen.getByRole('combobox', { name: 'Filtrar por servicio' }));
    await usuario.click(screen.getByRole('option', { name: 'Coloración' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/profesionales?activo=true&servicioId=${SERVICIO_COLOR_ID}&q=Diego`,
        expect.objectContaining({ credentials: 'include' }),
      ),
    );
  });

  it('oculta acciones de escritura para roles sin permiso de administración', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/v1/servicios?limite=100') {
        return respuestaJson({ datos: serviciosEjemplo, siguienteCursor: null });
      }
      if (url === '/api/v1/miembros') {
        return respuestaJson(miembrosEjemplo);
      }
      return respuestaJson({ datos: [profesional1], siguienteCursor: null });
    });
    vi.stubGlobal('fetch', fetchFalso);

    renderProfesionales(crearSesion('recepcion'));

    expect(await screen.findByText('Valentina Soto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo profesional' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Estado activo de Valentina Soto' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar a Valentina Soto' }),
    ).not.toBeInTheDocument();
  });

  it('crea un profesional enviando null en correo y teléfono vacíos y edita uno existente', async () => {
    const creado: Profesional = {
      ...profesional2,
      id: 'bbbb3333-3333-4333-8333-333333333333',
      nombre: 'Lucas Vera',
      activo: true,
    };

    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/v1/servicios?limite=100') {
        return respuestaJson({ datos: serviciosEjemplo, siguienteCursor: null });
      }
      if (url === '/api/v1/miembros') {
        return respuestaJson(miembrosEjemplo);
      }
      if (url === '/api/v1/profesionales' && init?.method === 'POST') {
        return respuestaJson(creado, 201);
      }
      if (url === `/api/v1/profesionales/${PROF_1_ID}` && init?.method === 'PATCH') {
        return respuestaJson({ ...profesional1, nombre: 'Valentina Soto M.' });
      }
      return respuestaJson({ datos: [profesional1], siguienteCursor: null });
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderProfesionales(crearSesion('admin'));
    expect(await screen.findByText('Valentina Soto')).toBeInTheDocument();

    // Crear con email y teléfono vacíos -> debe enviar null
    await usuario.click(screen.getByRole('button', { name: 'Nuevo profesional' }));
    const dialogoCrear = await screen.findByRole('dialog');
    await usuario.type(within(dialogoCrear).getByLabelText('Nombre completo'), 'Lucas Vera');
    await usuario.click(within(dialogoCrear).getByRole('button', { name: 'Crear profesional' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/profesionales',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            nombre: 'Lucas Vera',
            email: null,
            telefono: null,
            activo: true,
          }),
        }),
      ),
    );

    // Editar profesional existente
    await usuario.click(screen.getByRole('button', { name: 'Editar a Valentina Soto' }));
    const dialogoEditar = await screen.findByRole('dialog');
    const campoNombre = within(dialogoEditar).getByLabelText('Nombre completo');
    await usuario.clear(campoNombre);
    await usuario.type(campoNombre, 'Valentina Soto M.');
    await usuario.click(within(dialogoEditar).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/profesionales/${PROF_1_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            nombre: 'Valentina Soto M.',
            email: 'valentina@estudio.cl',
            telefono: '+56 9 1111 2222',
            activo: true,
          }),
        }),
      ),
    );
  });

  it('asigna múltiples servicios a un profesional mediante checkboxes', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/v1/servicios?limite=100') {
        return respuestaJson({ datos: serviciosEjemplo, siguienteCursor: null });
      }
      if (url === '/api/v1/miembros') {
        return respuestaJson(miembrosEjemplo);
      }
      if (url === `/api/v1/profesionales/${PROF_1_ID}/servicios` && init?.method === 'PUT') {
        return respuestaJson({
          ...profesional1,
          servicios: [
            { id: SERVICIO_CORTE_ID, nombre: 'Corte clásico', color: '#2563eb', activo: true },
            { id: SERVICIO_COLOR_ID, nombre: 'Coloración', color: '#db2777', activo: true },
          ],
        });
      }
      return respuestaJson({ datos: [profesional1], siguienteCursor: null });
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderProfesionales(crearSesion('dueno'));
    expect(await screen.findByText('Valentina Soto')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Asignar servicios a Valentina Soto' }));
    const dialogo = await screen.findByRole('dialog');

    const checkColor = within(dialogo).getByRole('checkbox', { name: 'Coloración' });
    expect(checkColor).not.toBeChecked();
    await usuario.click(checkColor);
    expect(checkColor).toBeChecked();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar servicios' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/profesionales/${PROF_1_ID}/servicios`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            servicioIds: [SERVICIO_CORTE_ID, SERVICIO_COLOR_ID],
          }),
        }),
      ),
    );
  });

  it('muestra error 409 CONFLICTO al vincular un miembro ya asociado y permite desvincular', async () => {
    let devolverConflicto = true;

    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/v1/servicios?limite=100') {
        return respuestaJson({ datos: serviciosEjemplo, siguienteCursor: null });
      }
      if (url === '/api/v1/miembros') {
        return respuestaJson(miembrosEjemplo);
      }
      if (url === `/api/v1/profesionales/${PROF_2_ID}/usuario` && init?.method === 'PUT') {
        if (devolverConflicto) {
          return respuestaJson(
            {
              codigo: 'CONFLICTO',
              mensaje: 'Esta cuenta ya está vinculada a otro profesional',
            },
            409,
          );
        }
        return respuestaJson({ ...profesional2, usuarioId: null });
      }
      return respuestaJson({ datos: [profesional2], siguienteCursor: null });
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderProfesionales(crearSesion('dueno'));
    expect(await screen.findByText('Diego Morales')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Vincular cuenta de Diego Morales' }));
    const dialogo = await screen.findByRole('dialog');

    await usuario.click(
      within(dialogo).getByRole('combobox', { name: 'Cuenta miembro a vincular' }),
    );
    await usuario.click(screen.getByRole('option', { name: /Matías Silva/ }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar vínculo' }));

    expect(
      await within(dialogo).findByText('Esta cuenta ya está vinculada a otro profesional'),
    ).toBeInTheDocument();

    devolverConflicto = false;
    await usuario.click(
      within(dialogo).getByRole('combobox', { name: 'Cuenta miembro a vincular' }),
    );
    await usuario.click(screen.getByRole('option', { name: 'Sin cuenta vinculada' }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar vínculo' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/profesionales/${PROF_2_ID}/usuario`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ usuarioId: null }),
        }),
      ),
    );
  });

  it('muestra error 409 CONFLICTO si el profesional tiene reservas al intentar eliminarlo', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/v1/servicios?limite=100') {
        return respuestaJson({ datos: serviciosEjemplo, siguienteCursor: null });
      }
      if (url === '/api/v1/miembros') {
        return respuestaJson(miembrosEjemplo);
      }
      if (url === `/api/v1/profesionales/${PROF_1_ID}` && init?.method === 'DELETE') {
        return respuestaJson(
          {
            codigo: 'CONFLICTO',
            mensaje: 'No se puede eliminar porque tiene reservas asociadas',
          },
          409,
        );
      }
      return respuestaJson({ datos: [profesional1], siguienteCursor: null });
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderProfesionales(crearSesion('dueno'));
    expect(await screen.findByText('Valentina Soto')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Eliminar a Valentina Soto' }));
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar eliminación' }));

    expect(
      await within(dialogo).findByText('No se puede eliminar porque tiene reservas asociadas'),
    ).toBeInTheDocument();
  });
});
