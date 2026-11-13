import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { simularFetch } from '@/test/utilidades';
import { api } from './client';
import { ApiError } from './errores';

const servicioSchema = z.object({ id: z.string(), nombre: z.string() });

/** Captura el error de una promesa que se espera que falle. */
async function capturarApiError(promesa: Promise<unknown>): Promise<ApiError> {
  const error = await promesa.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('cliente de API', () => {
  it('llama a /api/v1, envía la cookie y devuelve el dato validado', async () => {
    const fetchFalso = simularFetch(200, { id: '1', nombre: 'Corte' });

    const servicio = await api.get('/servicios/1', { schema: servicioSchema });

    expect(servicio).toEqual({ id: '1', nombre: 'Corte' });
    expect(fetchFalso).toHaveBeenCalledWith(
      '/api/v1/servicios/1',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('serializa el cuerpo como JSON y arma la cadena de consulta sin valores vacíos', async () => {
    const fetchFalso = simularFetch(200, { id: '1', nombre: 'Corte' });

    await api.post('/servicios', {
      cuerpo: { nombre: 'Corte' },
      consulta: { notificar: true, cursor: undefined },
      schema: servicioSchema,
    });

    const [url, init] = fetchFalso.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/servicios?notificar=true');
    expect(init?.body).toBe(JSON.stringify({ nombre: 'Corte' }));
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('convierte una respuesta de error de la API en ApiError con sus detalles', async () => {
    simularFetch(400, {
      codigo: 'VALIDACION',
      mensaje: 'Los datos enviados no son válidos',
      detalles: [{ campo: 'nombre', mensaje: 'Requerido' }],
      traceId: 'abc',
    });

    const error = await capturarApiError(api.post('/servicios', { cuerpo: {} }));

    expect(error.estado).toBe(400);
    expect(error.codigo).toBe('VALIDACION');
    expect(error.detalles).toEqual([{ campo: 'nombre', mensaje: 'Requerido' }]);
    expect(error.traceId).toBe('abc');
  });

  it('informa un error genérico si la respuesta de error no es de la API', async () => {
    simularFetch(502, '<html>Bad Gateway</html>');

    const error = await capturarApiError(api.get('/servicios'));

    expect(error.estado).toBe(502);
    expect(error.codigo).toBe('INTERNO');
  });

  it('informa un error de conexión cuando fetch falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await capturarApiError(api.get('/servicios'));

    expect(error.estado).toBe(0);
    expect(error.message).toMatch(/conectar/);
  });

  it('rechaza una respuesta exitosa que no cumple el contrato', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    simularFetch(200, { id: 1 });

    const error = await capturarApiError(api.get('/servicios/1', { schema: servicioSchema }));

    expect(error.codigo).toBe('INTERNO');
  });

  it('propaga la cancelación sin envolverla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Cancelada', 'AbortError')));

    await expect(api.get('/servicios')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
