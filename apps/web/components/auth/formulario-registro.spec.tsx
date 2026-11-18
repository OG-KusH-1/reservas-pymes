import type { Sesion } from '@portfolio/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores, simularFetch } from '@/test/utilidades';
import { FormularioRegistro } from './formulario-registro';

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
    nombre: 'Peluquería Sur',
    slug: 'peluqueria-sur',
    zonaHoraria: 'America/Santiago',
    moneda: 'CLP',
  },
  rol: 'dueno',
};

describe('FormularioRegistro', () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it('sugiere el slug mientras se escribe la empresa y deja de hacerlo tras editarlo a mano', async () => {
    const usuario = userEvent.setup();
    renderConProveedores(<FormularioRegistro />);

    const campoEmpresa = screen.getByLabelText('Nombre de la empresa');
    const campoSlug = screen.getByLabelText('Dirección de reservas');

    await usuario.type(campoEmpresa, 'Peluquería Ñuñoa');
    expect(campoSlug).toHaveValue('peluqueria-nunoa');

    await usuario.clear(campoSlug);
    await usuario.type(campoSlug, 'mi-salon');
    await usuario.type(campoEmpresa, ' Norte');

    expect(campoSlug).toHaveValue('mi-salon');
  });

  it('muestra el error de slug reservado cuando el nombre genera una palabra reservada como Panel', async () => {
    const fetchFalso = simularFetch(201, sesionEjemplo);
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioRegistro />);

    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'Panel');
    expect(screen.getByLabelText('Dirección de reservas')).toHaveValue('panel');

    await usuario.type(screen.getByLabelText('Tu nombre'), 'Camila Rojas');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-larga-123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Ese nombre no está disponible')).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('muestra errores por campo devueltos por el servidor', async () => {
    simularFetch(400, {
      codigo: 'VALIDACION',
      mensaje: 'Los datos enviados no son válidos',
      detalles: [{ campo: 'slug', mensaje: 'Esa dirección no está permitida' }],
    });
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioRegistro />);

    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'Peluquería Sur');
    await usuario.type(screen.getByLabelText('Tu nombre'), 'Camila Rojas');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-larga-123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Esa dirección no está permitida')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('muestra la alerta de conflicto cuando el correo o la dirección ya existen', async () => {
    simularFetch(409, {
      codigo: 'CONFLICTO',
      mensaje: 'Ya existe una cuenta registrada con ese correo electrónico',
    });
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioRegistro />);

    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'Peluquería Sur');
    await usuario.type(screen.getByLabelText('Tu nombre'), 'Camila Rojas');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-larga-123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe una cuenta registrada con ese correo electrónico',
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('envía el formulario válido y redirige al panel al tener éxito', async () => {
    const fetchFalso = simularFetch(201, sesionEjemplo);
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioRegistro />);

    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'Peluquería Sur');
    await usuario.type(screen.getByLabelText('Tu nombre'), 'Camila Rojas');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-larga-123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/auth/registro',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          nombreEmpresa: 'Peluquería Sur',
          slug: 'peluqueria-sur',
          nombre: 'Camila Rojas',
          email: 'camila@estudio.cl',
          password: 'clave-larga-123',
        }),
      }),
    );
  });
});
