import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppException } from './errors/app.exception.js';
import { codificarCursor, decodificarCursor, paginarResultados } from './paginacion.js';

const cursorEjemploSchema = z.object({
  nombre: z.string(),
  id: z.uuid(),
});

describe('paginación por cursor', () => {
  it('codifica y decodifica un cursor válido', () => {
    const entrada = {
      nombre: 'Corte clásico',
      id: '11111111-1111-4111-8111-111111111111',
    };

    const token = codificarCursor(entrada);
    expect(typeof token).toBe('string');
    expect(decodificarCursor(token, cursorEjemploSchema)).toEqual(entrada);
  });

  it('lanza VALIDACION (400) cuando el cursor es inválido o no cumple el esquema', () => {
    expect(() => decodificarCursor('no-es-json-valido', cursorEjemploSchema)).toThrow(AppException);

    const tokenIncompleto = codificarCursor({ nombre: 'Solo nombre' });
    try {
      decodificarCursor(tokenIncompleto, cursorEjemploSchema);
      expect.fail('Debió lanzar AppException');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).codigo).toBe('VALIDACION');
      expect((error as AppException).detalles).toEqual([
        { campo: 'cursor', mensaje: 'Cursor de paginación inválido' },
      ]);
    }
  });

  it('pagina correctamente cuando hay más filas que el límite (limite + 1)', () => {
    const filas = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const pagina = paginarResultados(filas, 2, (ultimo) => `cursor-${ultimo.id}`);

    expect(pagina).toEqual({
      datos: [{ id: '1' }, { id: '2' }],
      siguienteCursor: 'cursor-2',
    });
  });

  it('devuelve siguienteCursor en null cuando no hay más páginas o la lista está vacía', () => {
    expect(
      paginarResultados([{ id: '1' }, { id: '2' }], 2, (ultimo) => `cursor-${ultimo.id}`),
    ).toEqual({
      datos: [{ id: '1' }, { id: '2' }],
      siguienteCursor: null,
    });

    expect(paginarResultados([], 20, () => 'x')).toEqual({
      datos: [],
      siguienteCursor: null,
    });
  });
});
