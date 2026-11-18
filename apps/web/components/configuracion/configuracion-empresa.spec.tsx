import type { Empresa, RolMiembro, Sesion } from '@portfolio/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorSesion } from '@/components/panel/proveedor-sesion';
import { renderConProveedores, simularFetch } from '@/test/utilidades';
import { ConfiguracionEmpresa } from './configuracion-empresa';

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

function crearSesion(rol: RolMiembro = 'dueno'): Sesion {
  return {
    usuario: {
      id: '11111111-1111-4111-8111-111111111111',
      nombre: 'Camila Rojas',
      email: 'camila@peluqueriasur.cl',
      emailVerificado: true,
    },
    empresa: {
      id: empresaEjemplo.id,
      nombre: empresaEjemplo.nombre,
      slug: empresaEjemplo.slug,
      zonaHoraria: empresaEjemplo.zonaHoraria,
      moneda: empresaEjemplo.moneda,
    },
    rol,
  };
}

function renderConSesion(rol: RolMiembro = 'dueno') {
  return renderConProveedores(
    <ProveedorSesion sesionInicial={crearSesion(rol)}>
      <ConfiguracionEmpresa />
    </ProveedorSesion>,
  );
}

describe('ConfiguracionEmpresa', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it('muestra el estado de carga y luego renderiza los datos de la empresa', async () => {
    simularFetch(200, empresaEjemplo);

    renderConSesion('dueno');

    expect(screen.getByLabelText('Cargando configuración')).toBeInTheDocument();
    expect(await screen.findByLabelText('Nombre de la empresa')).toHaveValue('Peluquería Sur');
    expect(screen.getByLabelText('Identificador público (slug)')).toHaveValue('peluqueria-sur');
    expect(screen.getByLabelText('Intervalo de la grilla (minutos)')).toHaveValue(15);
  });

  it('muestra alerta de error y permite reintentar la carga', async () => {
    const fetchFalso = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            codigo: 'INTERNO',
            mensaje: 'No se pudo consultar la empresa',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(empresaEjemplo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderConSesion('dueno');

    expect(await screen.findByText('No pudimos cargar la configuración')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByLabelText('Nombre de la empresa')).toHaveValue('Peluquería Sur');
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('valida en cliente los rangos de las políticas de reserva antes de enviar', async () => {
    const fetchFalso = simularFetch(200, empresaEjemplo);
    const usuario = userEvent.setup();

    renderConSesion('dueno');

    const campoGrilla = await screen.findByLabelText('Intervalo de la grilla (minutos)');
    await usuario.clear(campoGrilla);
    await usuario.type(campoGrilla, '3');

    const campoMaxDias = screen.getByLabelText('Anticipación máxima (días)');
    await usuario.clear(campoMaxDias);
    await usuario.type(campoMaxDias, '0');

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Mínimo 5 minutos')).toBeInTheDocument();
    expect(screen.getByText('Debe ser al menos 1 día')).toBeInTheDocument();
    // Solo se llamó a GET /empresa, nunca a PATCH.
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('envía directamente cuando el slug no cambia y normaliza campos vacíos a null', async () => {
    const fetchFalso = vi.fn<typeof fetch>((_url, init) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...empresaEjemplo,
              nombre: 'Peluquería Sur Editada',
              rut: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(empresaEjemplo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderConSesion('dueno');

    const campoNombre = await screen.findByLabelText('Nombre de la empresa');
    await usuario.clear(campoNombre);
    await usuario.type(campoNombre, 'Peluquería Sur Editada');

    const campoRut = screen.getByLabelText('RUT o identificador fiscal');
    await usuario.clear(campoRut);

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/empresa',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const llamadaPatch = fetchFalso.mock.calls.find(([, init]) => init?.method === 'PATCH');
    const cuerpoEnviado = JSON.parse(String(llamadaPatch?.[1]?.body)) as Record<string, unknown>;
    expect(cuerpoEnviado.nombre).toBe('Peluquería Sur Editada');
    expect(cuerpoEnviado.rut).toBeNull();
  });

  it('abre diálogo de confirmación cuando cambia el slug y solo envía al confirmar', async () => {
    const fetchFalso = vi.fn<typeof fetch>((_url, init) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...empresaEjemplo,
              slug: 'peluqueria-centro',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(empresaEjemplo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderConSesion('admin');

    const campoSlug = await screen.findByLabelText('Identificador público (slug)');
    await usuario.clear(campoSlug);
    await usuario.type(campoSlug, 'peluqueria-centro');

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('¿Cambiar el identificador público?')).toBeInTheDocument();
    // Aún no se ha enviado PATCH.
    expect(fetchFalso.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);

    await usuario.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() =>
      expect(fetchFalso).toHaveBeenCalledWith(
        '/api/v1/empresa',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });

  it.each(['recepcion', 'profesional'] as const)(
    'muestra el formulario en solo lectura para el rol %s',
    async (rol) => {
      simularFetch(200, empresaEjemplo);
      renderConSesion(rol);

      expect(await screen.findByText('Modo solo lectura')).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre de la empresa')).toBeDisabled();
      expect(screen.getByLabelText('Intervalo de la grilla (minutos)')).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
    },
  );

  it('asigna los errores de validación del servidor al campo correspondiente', async () => {
    const fetchFalso = vi.fn<typeof fetch>((_url, init) => {
      if (init?.method === 'PATCH') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              codigo: 'VALIDACION',
              mensaje: 'Los datos enviados no son válidos',
              detalles: [{ campo: 'moneda', mensaje: 'Moneda no soportada por el sistema' }],
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(empresaEjemplo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchFalso);

    const usuario = userEvent.setup();
    renderConSesion('dueno');

    await screen.findByLabelText('Nombre de la empresa');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Moneda no soportada por el sistema')).toBeInTheDocument();
  });
});
