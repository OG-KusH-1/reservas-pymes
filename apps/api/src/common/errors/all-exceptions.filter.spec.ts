import { ForbiddenException, PayloadTooLargeException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AllExceptionsFilter,
  RESTRICCION_ANTISOLAPE,
  resumirParaRegistro,
} from './all-exceptions.filter.js';
import { AppException } from './app.exception.js';

/** Ejecuta el filtro con un contexto HTTP falso y devuelve lo que respondería. */
function ejecutar(excepcion: unknown) {
  const respuesta = {
    headersSent: false,
    estado: 0,
    cuerpo: undefined as unknown,
    status(codigo: number) {
      this.estado = codigo;
      return this;
    },
    json(cuerpo: unknown) {
      this.cuerpo = cuerpo;
      return this;
    },
    end: vi.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: 'traza-1', method: 'POST', path: '/api/v1/x' }),
      getResponse: () => respuesta,
    }),
  } as unknown as ArgumentsHost;

  const filtro = new AllExceptionsFilter();
  const registro = vi
    .spyOn((filtro as unknown as { logger: { error: () => void } }).logger, 'error')
    .mockImplementation(() => {});
  filtro.catch(excepcion, host);

  return {
    estado: respuesta.estado,
    cuerpo: respuesta.cuerpo as Record<string, unknown>,
    registro,
  };
}

/** Imita un error de postgres.js envuelto por Drizzle, con datos personales en el mensaje. */
function errorDeBaseDeDatos(campos: Record<string, string>) {
  const pg = Object.assign(new Error('detalle interno de PostgreSQL'), {
    name: 'PostgresError',
    detail: 'Failing row contains (ana@example.com, $argon2id$secreto)',
    ...campos,
  });
  return new Error(
    'Failed query: insert into usuarios ...\nparams: ana@example.com,$argon2id$secreto',
    {
      cause: pg,
    },
  );
}

describe('AllExceptionsFilter', () => {
  it('devuelve tal cual una AppException, con el traceId de la petición', () => {
    const { estado, cuerpo, registro } = ejecutar(
      AppException.validacion([{ campo: 'nombre', mensaje: 'Requerido' }]),
    );

    expect(estado).toBe(400);
    expect(cuerpo).toEqual({
      codigo: 'VALIDACION',
      mensaje: 'Los datos enviados no son válidos',
      detalles: [{ campo: 'nombre', mensaje: 'Requerido' }],
      traceId: 'traza-1',
    });
    expect(registro).not.toHaveBeenCalled();
  });

  it('traduce las excepciones HTTP de Nest sin reutilizar su mensaje en inglés', () => {
    const prohibido = ejecutar(new ForbiddenException('Forbidden resource'));
    expect(prohibido.estado).toBe(403);
    expect(prohibido.cuerpo.codigo).toBe('SIN_PERMISO');
    expect(prohibido.cuerpo.mensaje).not.toMatch(/Forbidden/);

    expect(ejecutar(new PayloadTooLargeException()).cuerpo.codigo).toBe('VALIDACION');
  });

  it.each([
    ['23P01', RESTRICCION_ANTISOLAPE, 409, 'RESERVA_SOLAPADA'],
    ['23505', 'usuarios_email_unique', 409, 'CONFLICTO'],
    ['23503', 'reservas_servicio_id_fk', 409, 'CONFLICTO'],
    ['23514', 'servicios_precio_chk', 400, 'VALIDACION'],
    ['22P02', undefined, 404, 'NO_ENCONTRADO'],
  ])('traduce el error %s de PostgreSQL', (code, restriccion, estadoEsperado, codigoEsperado) => {
    const { estado, cuerpo, registro } = ejecutar(
      errorDeBaseDeDatos({ code, ...(restriccion ? { constraint_name: restriccion } : {}) }),
    );

    expect(estado).toBe(estadoEsperado);
    expect(cuerpo.codigo).toBe(codigoEsperado);
    expect(registro).not.toHaveBeenCalled();
  });

  it('una exclusión de otra restricción no se informa como reserva solapada', () => {
    const { estado, cuerpo } = ejecutar(
      errorDeBaseDeDatos({ code: '23P01', constraint_name: 'otra_restriccion' }),
    );

    expect(estado).toBe(500);
    expect(cuerpo.codigo).toBe('INTERNO');
  });

  it('responde 500 genérico ante un error desconocido, sin filtrar su detalle', () => {
    const { estado, cuerpo, registro } = ejecutar(new Error('contraseña de la base: hunter2'));

    expect(estado).toBe(500);
    expect(cuerpo.codigo).toBe('INTERNO');
    expect(JSON.stringify(cuerpo)).not.toContain('hunter2');
    expect(registro).toHaveBeenCalledOnce();
  });

  it('no deja datos personales de un error de base de datos en el registro', () => {
    // 23502 (NOT NULL) no se traduce: indica un defecto y debe registrarse.
    const { estado, registro } = ejecutar(
      errorDeBaseDeDatos({ code: '23502', table_name: 'usuarios', column_name: 'nombre' }),
    );

    expect(estado).toBe(500);
    const registrado = JSON.stringify(registro.mock.calls);
    expect(registrado).not.toContain('ana@example.com');
    expect(registrado).not.toContain('argon2id');
    expect(registrado).toContain('23502');
    expect(registrado).toContain('usuarios');
  });
});

describe('resumirParaRegistro', () => {
  it('conserva nombre, mensaje y traza de un error común', () => {
    const resumen = resumirParaRegistro(new TypeError('x no es una función'));

    expect(resumen.tipo).toBe('TypeError');
    expect(resumen.mensaje).toBe('x no es una función');
    expect(resumen.traza).toContain('TypeError');
  });

  it('describe los valores lanzados que no son errores', () => {
    expect(resumirParaRegistro('texto suelto').tipo).toBe('string');
  });
});
