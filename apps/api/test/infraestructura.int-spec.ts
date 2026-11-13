import { errorApiSchema, saludSchema } from '@portfolio/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RESTRICCION_ANTISOLAPE } from '../src/common/errors/all-exceptions.filter.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import {
  crearCliente,
  crearEmpresa,
  crearProfesional,
  crearReserva,
  crearServicio,
} from './fabricas.js';

/**
 * Pruebas de la infraestructura base: verifican que los cimientos sobre los
 * que se construyen los módulos de negocio se comportan como promete la
 * documentación. Sirven además de ejemplo de cómo escribir una prueba de
 * integración (ver `test/app.ts` y `test/fabricas.ts`).
 */
describe('infraestructura de la API', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });
  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  describe('HTTP', () => {
    it('expone el chequeo de salud en /api/v1/health con la base conectada', async () => {
      const respuesta = await request(prueba.app.getHttpServer()).get('/api/v1/health').expect(200);

      const salud = saludSchema.parse(respuesta.body);
      expect(salud.status).toBe('ok');
      expect(salud.services.database).toBe('connected');
    });

    it('responde las rutas inexistentes con el formato de error estándar', async () => {
      const respuesta = await request(prueba.app.getHttpServer())
        .get('/api/v1/no-existe')
        .expect(404);

      const error = errorApiSchema.parse(respuesta.body);
      expect(error.codigo).toBe('NO_ENCONTRADO');
      // El identificador de la petición viaja en el cuerpo y en la cabecera.
      expect(error.traceId).toBe(respuesta.headers['x-request-id']);
    });

    it('agrega las cabeceras de seguridad', async () => {
      const respuesta = await request(prueba.app.getHttpServer()).get('/api/v1/health');

      expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
      expect(respuesta.headers['x-powered-by']).toBeUndefined();
    });

    it('publica la documentación OpenAPI fuera de producción', async () => {
      const respuesta = await request(prueba.app.getHttpServer()).get('/api/docs-json').expect(200);

      expect(respuesta.body.paths).toHaveProperty('/api/v1/health');
    });
  });

  describe('restricción antisolape de reservas', () => {
    const inicio = new Date('2030-01-07T13:00:00Z');
    const minutos = (n: number) => new Date(inicio.getTime() + n * 60_000);

    async function prepararAgenda() {
      const empresa = await crearEmpresa(prueba.db);
      const [servicio, profesional, cliente] = await Promise.all([
        crearServicio(prueba.db, { empresaId: empresa.id }),
        crearProfesional(prueba.db, { empresaId: empresa.id }),
        crearCliente(prueba.db, { empresaId: empresa.id }),
      ]);
      return {
        empresaId: empresa.id,
        servicioId: servicio.id,
        profesionalId: profesional.id,
        clienteId: cliente.id,
      };
    }

    /** Extrae el error de PostgreSQL, que Drizzle envuelve en `cause`. */
    async function errorPostgres(operacion: Promise<unknown>) {
      const error = await operacion.then(
        () => undefined,
        (e: unknown) => e,
      );
      const causa = (error as { cause?: unknown } | undefined)?.cause ?? error;
      return causa as { code?: string; constraint_name?: string } | undefined;
    }

    it('rechaza dos reservas que se cruzan para el mismo profesional', async () => {
      const agenda = await prepararAgenda();
      await crearReserva(prueba.db, { ...agenda, fechaHoraInicio: inicio });

      const error = await errorPostgres(
        crearReserva(prueba.db, { ...agenda, fechaHoraInicio: minutos(15) }),
      );

      expect(error?.code).toBe('23P01');
      expect(error?.constraint_name).toBe(RESTRICCION_ANTISOLAPE);
    });

    it('permite reservas consecutivas: el fin de una puede ser el inicio de otra', async () => {
      const agenda = await prepararAgenda();
      await crearReserva(prueba.db, { ...agenda, fechaHoraInicio: inicio });

      await expect(
        crearReserva(prueba.db, { ...agenda, fechaHoraInicio: minutos(30) }),
      ).resolves.toBeDefined();
    });

    it('considera el margen posterior del servicio (bloqueo_hasta)', async () => {
      const agenda = await prepararAgenda();
      await crearReserva(prueba.db, {
        ...agenda,
        fechaHoraInicio: inicio,
        bloqueoHasta: minutos(45), // 30 de atención + 15 de margen
      });

      const error = await errorPostgres(
        crearReserva(prueba.db, { ...agenda, fechaHoraInicio: minutos(30) }),
      );

      expect(error?.constraint_name).toBe(RESTRICCION_ANTISOLAPE);
    });

    it('una reserva cancelada libera el horario', async () => {
      const agenda = await prepararAgenda();
      await crearReserva(prueba.db, { ...agenda, fechaHoraInicio: inicio, estado: 'cancelada' });

      await expect(
        crearReserva(prueba.db, { ...agenda, fechaHoraInicio: inicio }),
      ).resolves.toBeDefined();
    });

    it('no afecta a otro profesional en el mismo horario', async () => {
      const agenda = await prepararAgenda();
      const otro = await crearProfesional(prueba.db, { empresaId: agenda.empresaId });
      await crearReserva(prueba.db, { ...agenda, fechaHoraInicio: inicio });

      await expect(
        crearReserva(prueba.db, { ...agenda, profesionalId: otro.id, fechaHoraInicio: inicio }),
      ).resolves.toBeDefined();
    });
  });
});
