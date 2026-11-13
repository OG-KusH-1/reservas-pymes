import type { ArgumentMetadata } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppException } from '../errors/app.exception.js';
import { createZodDto, esZodDto } from './zod-dto.js';
import { ZodPipe, ZodValidationPipe } from './zod-validation.pipe.js';

const servicioSchema = z.object({
  nombre: z.string().trim().min(1),
  duracionMinutos: z.coerce.number().int().positive().default(30),
});
class ServicioDto extends createZodDto(servicioSchema) {}

const cuerpoDe = (metatype: unknown): ArgumentMetadata =>
  ({ type: 'body', metatype }) as ArgumentMetadata;

function capturar(operacion: () => unknown): AppException {
  try {
    operacion();
  } catch (error) {
    expect(error).toBeInstanceOf(AppException);
    return error as AppException;
  }
  throw new Error('Se esperaba una excepción');
}

describe('createZodDto', () => {
  it('produce una clase que lleva el esquema y se reconoce como DTO de Zod', () => {
    expect(ServicioDto.schema).toBe(servicioSchema);
    expect(esZodDto(ServicioDto)).toBe(true);
  });

  it('no confunde otros tipos con un DTO de Zod', () => {
    expect(esZodDto(String)).toBe(false);
    expect(esZodDto(class Cualquiera {})).toBe(false);
    expect(esZodDto(undefined)).toBe(false);
  });
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('devuelve el valor transformado por el esquema (recortes, conversiones y valores por defecto)', () => {
    expect(pipe.transform({ nombre: '  Corte ' }, cuerpoDe(ServicioDto))).toEqual({
      nombre: 'Corte',
      duracionMinutos: 30,
    });
  });

  it('descarta las propiedades que el esquema no declara', () => {
    const resultado = pipe.transform({ nombre: 'Corte', empresaId: 'otra' }, cuerpoDe(ServicioDto));

    expect(resultado).not.toHaveProperty('empresaId');
  });

  it('lanza VALIDACION con el detalle de cada campo inválido', () => {
    const error = capturar(() =>
      pipe.transform({ nombre: '', duracionMinutos: -5 }, cuerpoDe(ServicioDto)),
    );

    expect(error.codigo).toBe('VALIDACION');
    expect(error.estado).toBe(400);
    expect(error.detalles?.map((d) => d.campo).sort()).toEqual(['duracionMinutos', 'nombre']);
  });

  it('deja pasar sin tocar los parámetros que no son DTO de Zod', () => {
    expect(pipe.transform('abc', cuerpoDe(String))).toBe('abc');
  });
});

describe('ZodPipe', () => {
  it('valida un parámetro suelto y antepone su nombre al campo', () => {
    const pipe = new ZodPipe(z.uuid());
    const metadatos = { type: 'param', data: 'id' } as ArgumentMetadata;

    const error = capturar(() => pipe.transform('no-es-uuid', metadatos));

    expect(error.codigo).toBe('VALIDACION');
    expect(error.detalles?.[0]?.campo).toBe('id');
  });
});
