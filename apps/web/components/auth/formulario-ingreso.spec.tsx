import type { Sesion } from '@portfolio/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderConProveedores, simularFetch } from '@/test/utilidades';
import { esRutaInterna, FormularioIngreso } from './formulario-ingreso';

const replaceMock = vi.fn();
let searchParamsActual = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsActual,
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

describe('esRutaInterna', () => {
  const origen = 'https://agenda.example.com';

  it('acepta rutas internas válidas', () => {
    expect(esRutaInterna('/panel', origen)).toBe(true);
    expect(esRutaInterna('/panel/reservas?vista=semana', origen)).toBe(true);
  });

  it('rechaza rutas externas, protocolos relativos, barras invertidas y valores vacíos', () => {
    expect(esRutaInterna('https://evil.com', origen)).toBe(false);
    expect(esRutaInterna('//evil.com', origen)).toBe(false);
    expect(esRutaInterna('/\\evil.com', origen)).toBe(false);
    expect(esRutaInterna('javascript:alert(1)', origen)).toBe(false);
    expect(esRutaInterna('', origen)).toBe(false);
    expect(esRutaInterna(null, origen)).toBe(false);
    expect(esRutaInterna(undefined, origen)).toBe(false);
  });
});

describe('FormularioIngreso', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsActual = new URLSearchParams();
  });

  it('valida campos vacíos sin llamar a la API y enfoca el primer campo con error', async () => {
    const fetchFalso = simularFetch(200, sesionEjemplo);
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioIngreso />);

    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Correo electrónico inválido')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Correo electrónico')).toHaveFocus();
  });

  it('envía las credenciales correctas y redirige al panel al tener éxito', async () => {
    const fetchFalso = simularFetch(200, sesionEjemplo);
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioIngreso />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'Camila@Estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'mi-clave-segura');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/auth/ingresar',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'camila@estudio.cl', password: 'mi-clave-segura' }),
      }),
    );
  });

  it('permite mostrar y ocultar la contraseña', async () => {
    const usuario = userEvent.setup();
    renderConProveedores(<FormularioIngreso />);

    const campoPassword = screen.getByLabelText('Contraseña');
    expect(campoPassword).toHaveAttribute('type', 'password');

    await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campoPassword).toHaveAttribute('type', 'text');

    await usuario.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campoPassword).toHaveAttribute('type', 'password');
  });

  it('muestra el error de credenciales cuando la API responde NO_AUTENTICADO', async () => {
    simularFetch(401, {
      codigo: 'NO_AUTENTICADO',
      mensaje: 'Correo o contraseña incorrectos',
    });
    const usuario = userEvent.setup();

    renderConProveedores(<FormularioIngreso />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-incorrecta');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('respeta ?siguiente= si es interna e ignora destinos externos', async () => {
    const usuario = userEvent.setup();

    // Caso interno válido
    searchParamsActual = new URLSearchParams('siguiente=/panel/agenda');
    simularFetch(200, sesionEjemplo);
    const { unmount } = renderConProveedores(<FormularioIngreso />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'mi-clave-segura');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel/agenda'));
    unmount();

    // Casos externos maliciosos
    for (const externo of ['https://evil.com', '//evil.com', '/\\evil.com']) {
      replaceMock.mockReset();
      searchParamsActual = new URLSearchParams(`siguiente=${externo}`);
      simularFetch(200, sesionEjemplo);
      const vista = renderConProveedores(<FormularioIngreso />);

      await usuario.type(screen.getByLabelText('Correo electrónico'), 'camila@estudio.cl');
      await usuario.type(screen.getByLabelText('Contraseña'), 'mi-clave-segura');
      await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

      await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/panel'));
      vista.unmount();
    }
  });
});
