import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { errorApiSchema } from '@portfolio/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createZodDto } from '../src/common/zod/zod-dto.js';
import { usuarios } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import { crearUsuario } from './fabricas.js';

/**
 * Comprueba de punta a punta la validación de entradas y el formato de
 * errores, usando un controlador que solo existe en esta prueba.
 *
 * Es además el ejemplo de cómo probar una pieza transversal sin depender de
 * un endpoint real: se declara un controlador aquí mismo y se registra con
 * `crearAppDePrueba({ controladores })`.
 */
class EcoDto extends createZodDto(
  z.object({ nombre: z.string().trim().min(2), cantidad: z.coerce.number().int().positive() }),
) {}

let prueba: AppDePrueba;

@Controller('prueba')
class PruebaController {
  @Post('eco')
  eco(@Body() datos: EcoDto) {
    return datos;
  }

  @Post('usuario-duplicado')
  async duplicar() {
    const existente = await crearUsuario(prueba.db);
    // Viola la unicidad de `usuarios.email`.
    await crearUsuario(prueba.db, { email: existente.email });
  }

  @Get('usuarios/:id')
  usuario(@Param('id') id: string) {
    // A propósito sin `ZodPipe`: un id mal formado llega hasta PostgreSQL.
    return prueba.db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, id));
  }

  @Get('falla')
  falla() {
    throw new Error('detalle interno que no debe salir');
  }
}

describe('validación y errores (integración)', () => {
  beforeAll(async () => {
    prueba = await crearAppDePrueba({ controladores: [PruebaController] });
  });
  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  const http = () => request(prueba.app.getHttpServer());

  it('entrega al controlador los datos validados y transformados', async () => {
    const respuesta = await http()
      .post('/api/v1/prueba/eco')
      .send({ nombre: '  Ana ', cantidad: '3', extra: 'x' })
      .expect(201);

    expect(respuesta.body).toEqual({ nombre: 'Ana', cantidad: 3 });
  });

  it('responde 400 con el detalle por campo, en español', async () => {
    const respuesta = await http().post('/api/v1/prueba/eco').send({ cantidad: 0 }).expect(400);

    const error = errorApiSchema.parse(respuesta.body);
    expect(error.codigo).toBe('VALIDACION');
    expect(error.detalles?.map((d) => d.campo).sort()).toEqual(['cantidad', 'nombre']);
    expect(error.detalles?.find((d) => d.campo === 'nombre')?.mensaje).toMatch(/inválid|esperaba/i);
  });

  it('responde 400 con formato estándar ante un JSON mal formado', async () => {
    const respuesta = await http()
      .post('/api/v1/prueba/eco')
      .set('Content-Type', 'application/json')
      .send('{"nombre": ')
      .expect(400);

    expect(errorApiSchema.parse(respuesta.body).codigo).toBe('VALIDACION');
  });

  it('traduce una violación de unicidad a 409 CONFLICTO', async () => {
    const respuesta = await http().post('/api/v1/prueba/usuario-duplicado').expect(409);

    expect(errorApiSchema.parse(respuesta.body).codigo).toBe('CONFLICTO');
  });

  it('un identificador mal formado responde 404 y no 500', async () => {
    const respuesta = await http().get('/api/v1/prueba/usuarios/no-es-uuid').expect(404);

    expect(errorApiSchema.parse(respuesta.body).codigo).toBe('NO_ENCONTRADO');
  });

  it('un error inesperado responde 500 genérico sin filtrar el detalle', async () => {
    const respuesta = await http().get('/api/v1/prueba/falla').expect(500);

    const error = errorApiSchema.parse(respuesta.body);
    expect(error.codigo).toBe('INTERNO');
    expect(JSON.stringify(respuesta.body)).not.toContain('detalle interno');
    expect(error.traceId).toBe(respuesta.headers['x-request-id']);
  });
});
