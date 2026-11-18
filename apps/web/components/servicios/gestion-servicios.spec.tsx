import type { PaginaServicios, Servicio, Sesion } from '@portfolio/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ProveedorSesion } from '@/components/panel/proveedor-sesion';
import { GestionServicios } from './gestion-servicios';

beforeAll(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const SERVICIO_1_ID = '11111111-1111-4111-8111-111111111111';
const SERVICIO_2_ID = '22222222-2222-4222-8222-222222222222';
const SERVICIO_3_ID = '33333333-3333-4333-8333-333333333333';

const serviciosPagina1: Servicio[] = [
  {
    id: SERVICIO_1_ID,
    nombre: 'Corte clásico',
    descripcion: 'Incluye lavado y peinado',
    categoria: 'Peluquería',
    duracionMinutos: 45,
    margenPosteriorMinutos: 15,
    precio: 15000,
    visiblePublico: true,
    color: '#2563EB',
    activo: true,
    creadoEn: '2026-11-10T12:00:00.000Z',
    actualizadoEn: '2026-11-10T12:00:00.000Z',
  },
  {
    id: SERVICIO_2_ID,
    nombre: 'Evaluación interna',
    descripcion: null,
    categoria: null,
    duracionMinutos: 90,
    margenPosteriorMinutos: 0,
    precio: 0,
    visiblePublico: false,
    color: null,
    activo: false,
    creadoEn: '2026-11-11T12:00:00.000Z',
    actualizadoEn: '2026-11-11T12:00:00.000Z',
  },
];

const servicioPagina2: Servicio = {
  id: SERVICIO_3_ID,
  nombre: 'Perfilado de barba',
  descripcion: 'Con toalla caliente',
  categoria: 'Barbería',
  duracionMinutos: 30,
  margenPosteriorMinutos: 0,
  precio: 10000,
  visiblePublico: true,
  color: '#0D9488',
  activo: true,
  creadoEn: '2026-11-12T12:00:00.000Z',
  actualizadoEn: '2026-11-12T12:00:00.000Z',
};

function crearSesion(rol: Sesion['rol']): Sesion {
  return {
    usuario: {
      id: '99999999-9999-4999-8999-999999999991',
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

function renderServicios(rol: Sesion['rol'] = 'dueno') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProveedorSesion sesionInicial={crearSesion(rol)}>
        <GestionServicios />
      </ProveedorSesion>
    </QueryClientProvider>,
  );
}

function respuestaJson(estado: number, cuerpo: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('GestionServicios', () => {
  it('muestra la tabla formateada, filtros y paginación «Cargar más»', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url === '/api/v1/servicios') {
        const pagina: PaginaServicios = {
          datos: serviciosPagina1,
          siguienteCursor: 'cursor-siguiente',
        };
        return respuestaJson(200, pagina);
      }
      if (url === '/api/v1/servicios?cursor=cursor-siguiente') {
        const pagina: PaginaServicios = {
          datos: [servicioPagina2],
          siguienteCursor: null,
        };
        return respuestaJson(200, pagina);
      }
      if (url.startsWith('/api/v1/servicios?')) {
        const pagina: PaginaServicios = {
          datos: serviciosPagina1.slice(0, 1),
          siguienteCursor: null,
        };
        return respuestaJson(200, pagina);
      }
      return respuestaJson(200, { datos: [], siguienteCursor: null });
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderServicios('dueno');

    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();
    expect(screen.getByText('Evaluación interna')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('+ 15 min prep.')).toBeInTheDocument();
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
    expect(screen.getByText('$15.000')).toBeInTheDocument();
    expect(screen.getByText('Público')).toBeInTheDocument();
    expect(screen.getByText('Solo panel')).toBeInTheDocument();

    // Paginación «Cargar más»
    await usuario.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('Perfilado de barba')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();

    // Filtro por estado
    await usuario.click(screen.getByRole('combobox', { name: 'Filtrar por estado' }));
    await usuario.click(screen.getByRole('option', { name: 'Activos' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/servicios?activo=true',
        expect.objectContaining({ method: 'GET' }),
      ),
    );

    // Búsqueda por texto con retardo
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar servicios' }), 'corte');
    await waitFor(
      () =>
        expect(fetchFalso).toHaveBeenCalledWith(
          '/api/v1/servicios?activo=true&q=corte',
          expect.objectContaining({ method: 'GET' }),
        ),
      { timeout: 1500 },
    );
  });

  it('oculta acciones de creación y edición para roles sin permiso (recepcion)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() =>
        respuestaJson(200, { datos: serviciosPagina1, siguienteCursor: null }),
      ),
    );

    renderServicios('recepcion');

    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo servicio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Corte clásico' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Eliminar Corte clásico' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'Estado activo de Corte clásico' }),
    ).not.toBeInTheDocument();
  });

  it('muestra estados de error con reintento y estado vacío', async () => {
    const fetchFalso = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        respuestaJson(500, { codigo: 'INTERNO', mensaje: 'Error temporal del servidor' }),
      )
      .mockImplementationOnce(() => respuestaJson(200, { datos: [], siguienteCursor: null }));
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderServicios('admin');

    expect(await screen.findByText('No pudimos cargar los servicios')).toBeInTheDocument();
    expect(screen.getByText('Error temporal del servidor')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Aún no hay servicios en el catálogo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear primer servicio' })).toBeInTheDocument();
  });

  it('valida el formulario de alta, normaliza campos opcionales vacíos y maneja 409 CONFLICTO', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      if (input === '/api/v1/servicios' && (!init?.method || init.method === 'GET')) {
        return respuestaJson(200, { datos: serviciosPagina1, siguienteCursor: null });
      }
      if (input === '/api/v1/servicios' && init?.method === 'POST') {
        const cuerpo = JSON.parse(String(init.body)) as { nombre: string };
        if (cuerpo.nombre === 'Corte clásico') {
          return respuestaJson(409, {
            codigo: 'CONFLICTO',
            mensaje: 'Ya existe un servicio con ese nombre',
          });
        }
        return respuestaJson(201, {
          ...serviciosPagina1[0],
          id: SERVICIO_3_ID,
          nombre: cuerpo.nombre,
          descripcion: null,
          categoria: null,
          color: '#0D9488',
        });
      }
      return respuestaJson(204, null);
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderServicios('dueno');
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Nuevo servicio' }));
    const dialogo = await screen.findByRole('dialog');

    // Validación en cliente con nombre vacío
    await usuario.click(within(dialogo).getByRole('button', { name: 'Crear servicio' }));
    expect(
      await within(dialogo).findByText('Debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();

    // Envío con nombre duplicado -> 409 CONFLICTO del servidor
    const campoNombre = within(dialogo).getByLabelText('Nombre');
    await usuario.type(campoNombre, 'Corte clásico');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Crear servicio' }));

    expect(
      await within(dialogo).findByText('Ya existe un servicio con ese nombre'),
    ).toBeInTheDocument();

    // Corrección del nombre y selección de color de paleta, dejando opcionales vacíos
    await usuario.clear(campoNombre);
    await usuario.type(campoNombre, 'Lavado express');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Seleccionar color #0D9488' }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/servicios',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            nombre: 'Lavado express',
            descripcion: null,
            categoria: null,
            duracionMinutos: 30,
            margenPosteriorMinutos: 0,
            precio: 0,
            visiblePublico: true,
            color: '#0D9488',
            activo: true,
          }),
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('permite editar, activar/desactivar rápido y muestra 409 CONFLICTO al eliminar', async () => {
    const fetchFalso = vi.fn<typeof fetch>((input, init) => {
      if (input === '/api/v1/servicios' && (!init?.method || init.method === 'GET')) {
        return respuestaJson(200, { datos: serviciosPagina1, siguienteCursor: null });
      }
      if (input === `/api/v1/servicios/${SERVICIO_1_ID}` && init?.method === 'PATCH') {
        const parcial = JSON.parse(String(init.body)) as Partial<Servicio>;
        return respuestaJson(200, { ...serviciosPagina1[0], ...parcial });
      }
      if (input === `/api/v1/servicios/${SERVICIO_1_ID}` && init?.method === 'DELETE') {
        return respuestaJson(409, {
          codigo: 'CONFLICTO',
          mensaje: 'No se puede eliminar porque tiene reservas asociadas',
        });
      }
      return respuestaJson(204, null);
    });
    vi.stubGlobal('fetch', fetchFalso);
    const usuario = userEvent.setup();

    renderServicios('dueno');
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();

    // Cambio rápido de estado activo
    await usuario.click(screen.getByRole('switch', { name: 'Estado activo de Corte clásico' }));
    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/servicios/${SERVICIO_1_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ activo: false }),
        }),
      ),
    );

    // Edición de servicio
    await usuario.click(screen.getByRole('button', { name: 'Editar Corte clásico' }));
    const dialogoEdicion = await screen.findByRole('dialog');
    const campoNombre = within(dialogoEdicion).getByLabelText('Nombre');
    expect(campoNombre).toHaveValue('Corte clásico');
    await usuario.clear(campoNombre);
    await usuario.type(campoNombre, 'Corte renovado');
    await usuario.click(within(dialogoEdicion).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        `/api/v1/servicios/${SERVICIO_1_ID}`,
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Eliminación con 409 CONFLICTO visible en el diálogo
    await usuario.click(screen.getByRole('button', { name: 'Eliminar Corte clásico' }));
    const dialogoEliminar = await screen.findByRole('dialog');
    await usuario.click(within(dialogoEliminar).getByRole('button', { name: 'Eliminar servicio' }));

    expect(
      await within(dialogoEliminar).findByText(
        'No se puede eliminar porque tiene reservas asociadas',
      ),
    ).toBeInTheDocument();
  });
});
