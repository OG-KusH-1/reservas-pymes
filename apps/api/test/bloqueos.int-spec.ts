import { randomBytes, randomUUID } from 'node:crypto';
import {
  bloqueoSchema,
  errorApiSchema,
  resultadoBloqueoSchema,
  type RolMiembro,
} from '@portfolio/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COOKIE_SESION } from '../src/app.setup.js';
import { hashTokenSesion } from '../src/auth/session.service.js';
import { sesiones } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import {
  crearBloqueo,
  crearCliente,
  crearMiembro,
  crearProfesional,
  crearReserva,
  crearServicio,
  crearSesionDePrueba,
  crearUsuario,
} from './fabricas.js';

describe('bloqueos de disponibilidad (integración)', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });

  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  const http = () => request(prueba.app.getHttpServer());

  async function crearSesionEnEmpresa(empresaId: string, rol: RolMiembro) {
    const usuario = await crearUsuario(prueba.db);
    await crearMiembro(prueba.db, { empresaId, usuarioId: usuario.id, rol });
    const token = randomBytes(32).toString('base64url');
    await prueba.db.insert(sesiones).values({
      usuarioId: usuario.id,
      empresaId,
      tokenHash: hashTokenSesion(token),
      expiraEn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return { usuario, cookie: `${COOKIE_SESION}=${token}` };
  }

  describe('autenticación y permisos por rol', () => {
    it('rechaza peticiones sin sesión con 401 NO_AUTENTICADO', async () => {
      const id = randomUUID();

      const resGet = await http().get('/api/v1/bloqueos').expect(401);
      expect(errorApiSchema.parse(resGet.body).codigo).toBe('NO_AUTENTICADO');

      await http()
        .post('/api/v1/bloqueos')
        .send({
          inicio: '2026-11-20T10:00:00Z',
          fin: '2026-11-20T12:00:00Z',
        })
        .expect(401);

      await http().patch(`/api/v1/bloqueos/${id}`).send({ motivo: 'Ajuste' }).expect(401);

      await http().delete(`/api/v1/bloqueos/${id}`).expect(401);
    });

    it('permite lectura a recepcion, pero bloquea escritura con 403 SIN_PERMISO', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionRecepcion = await crearSesionEnEmpresa(sesionDueno.empresa.id, 'recepcion');
      const bloqueo = await crearBloqueo(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        inicio: new Date('2026-11-20T10:00:00Z'),
        fin: new Date('2026-11-20T12:00:00Z'),
      });

      await http().get('/api/v1/bloqueos').set('Cookie', sesionRecepcion.cookie).expect(200);

      const resCrear = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesionRecepcion.cookie)
        .send({
          inicio: '2026-11-21T10:00:00Z',
          fin: '2026-11-21T12:00:00Z',
        })
        .expect(403);
      expect(errorApiSchema.parse(resCrear.body).codigo).toBe('SIN_PERMISO');

      await http()
        .patch(`/api/v1/bloqueos/${bloqueo.id}`)
        .set('Cookie', sesionRecepcion.cookie)
        .send({ motivo: 'Feriado' })
        .expect(403);

      await http()
        .delete(`/api/v1/bloqueos/${bloqueo.id}`)
        .set('Cookie', sesionRecepcion.cookie)
        .expect(403);
    });

    it('permite a profesional gestionar solo sus propios bloqueos y rechaza los de empresa o ajenos con 403', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionProf = await crearSesionEnEmpresa(sesionDueno.empresa.id, 'profesional');
      const profPropio = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        usuarioId: sesionProf.usuario.id,
      });
      const profAjeno = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
      });

      const bloqueoEmpresa = await crearBloqueo(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        profesionalId: null,
        inicio: new Date('2026-11-20T09:00:00Z'),
        fin: new Date('2026-11-20T18:00:00Z'),
      });
      const bloqueoAjeno = await crearBloqueo(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        profesionalId: profAjeno.id,
        inicio: new Date('2026-11-21T09:00:00Z'),
        fin: new Date('2026-11-21T12:00:00Z'),
      });

      // Rechaza crear bloqueo de empresa o de otro profesional
      const resCrearEmpresa = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesionProf.cookie)
        .send({
          profesionalId: null,
          inicio: '2026-11-22T10:00:00Z',
          fin: '2026-11-22T12:00:00Z',
        })
        .expect(403);
      expect(errorApiSchema.parse(resCrearEmpresa.body).codigo).toBe('SIN_PERMISO');

      await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesionProf.cookie)
        .send({
          profesionalId: profAjeno.id,
          inicio: '2026-11-22T10:00:00Z',
          fin: '2026-11-22T12:00:00Z',
        })
        .expect(403);

      // Rechaza editar y eliminar bloqueos de empresa o ajenos
      await http()
        .patch(`/api/v1/bloqueos/${bloqueoEmpresa.id}`)
        .set('Cookie', sesionProf.cookie)
        .send({ motivo: 'Intento' })
        .expect(403);
      await http()
        .delete(`/api/v1/bloqueos/${bloqueoEmpresa.id}`)
        .set('Cookie', sesionProf.cookie)
        .expect(403);
      await http()
        .patch(`/api/v1/bloqueos/${bloqueoAjeno.id}`)
        .set('Cookie', sesionProf.cookie)
        .send({ motivo: 'Intento' })
        .expect(403);
      await http()
        .delete(`/api/v1/bloqueos/${bloqueoAjeno.id}`)
        .set('Cookie', sesionProf.cookie)
        .expect(403);

      // Permite crear, editar y eliminar su propio bloqueo
      const resCrearPropio = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesionProf.cookie)
        .send({
          profesionalId: profPropio.id,
          inicio: '2026-11-22T13:00:00Z',
          fin: '2026-11-22T14:00:00Z',
          motivo: 'Colación',
        })
        .expect(201);
      const creado = resultadoBloqueoSchema.parse(resCrearPropio.body);

      const resEditarPropio = await http()
        .patch(`/api/v1/bloqueos/${creado.bloqueo.id}`)
        .set('Cookie', sesionProf.cookie)
        .send({ motivo: 'Almuerzo' })
        .expect(200);
      expect(resultadoBloqueoSchema.parse(resEditarPropio.body).bloqueo.motivo).toBe('Almuerzo');

      await http()
        .delete(`/api/v1/bloqueos/${creado.bloqueo.id}`)
        .set('Cookie', sesionProf.cookie)
        .expect(204);
    });
  });

  describe('listado y filtros', () => {
    it('filtra por desde, hasta y profesionalId, ordenados por inicio ascendente', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'admin' });
      const prof1 = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });
      const prof2 = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });

      const bAntes = await crearBloqueo(prueba.db, {
        empresaId: sesion.empresa.id,
        profesionalId: prof1.id,
        inicio: new Date('2026-11-10T08:00:00Z'),
        fin: new Date('2026-11-10T10:00:00Z'),
      });
      const bEnRango1 = await crearBloqueo(prueba.db, {
        empresaId: sesion.empresa.id,
        profesionalId: prof1.id,
        inicio: new Date('2026-11-15T14:00:00Z'),
        fin: new Date('2026-11-15T16:00:00Z'),
      });
      const bEnRango2 = await crearBloqueo(prueba.db, {
        empresaId: sesion.empresa.id,
        profesionalId: prof2.id,
        inicio: new Date('2026-11-15T11:00:00Z'),
        fin: new Date('2026-11-15T13:00:00Z'),
      });
      await crearBloqueo(prueba.db, {
        empresaId: sesion.empresa.id,
        profesionalId: null,
        inicio: new Date('2026-11-20T09:00:00Z'),
        fin: new Date('2026-11-20T18:00:00Z'),
      });

      // Rango que excluye bAntes (fin === desde) y el del 20 (inicio >= hasta)
      const resRango = await http()
        .get('/api/v1/bloqueos')
        .query({
          desde: '2026-11-10T10:00:00Z',
          hasta: '2026-11-20T09:00:00Z',
        })
        .set('Cookie', sesion.cookie)
        .expect(200);

      const enRango = bloqueoSchema.array().parse(resRango.body);
      expect(enRango.map((b) => b.id)).toEqual([bEnRango2.id, bEnRango1.id]);

      // Filtro por profesionalId
      const resProf1 = await http()
        .get('/api/v1/bloqueos')
        .query({ profesionalId: prof1.id })
        .set('Cookie', sesion.cookie)
        .expect(200);
      const deProf1 = bloqueoSchema.array().parse(resProf1.body);
      expect(deProf1.map((b) => b.id)).toEqual([bAntes.id, bEnRango1.id]);
    });
  });

  describe('creación, actualización, eliminación y conteo de reservas afectadas', () => {
    it('valida el rango en PATCH parcial y permite actualizar y eliminar bloqueos', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const resCrear = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesion.cookie)
        .send({
          inicio: '2026-11-25T10:00:00Z',
          fin: '2026-11-25T12:00:00Z',
          motivo: 'Capacitación',
        })
        .expect(201);
      const creado = resultadoBloqueoSchema.parse(resCrear.body);
      expect(creado.bloqueo.profesionalId).toBeNull();
      expect(creado.reservasAfectadas).toBe(0);

      // Cambio parcial de inicio >= fin existente -> 400 VALIDACION
      const resInicioInvalido = await http()
        .patch(`/api/v1/bloqueos/${creado.bloqueo.id}`)
        .set('Cookie', sesion.cookie)
        .send({ inicio: '2026-11-25T12:00:00Z' })
        .expect(400);
      expect(errorApiSchema.parse(resInicioInvalido.body).codigo).toBe('VALIDACION');

      // Cambio parcial de fin <= inicio existente -> 400 VALIDACION
      const resFinInvalido = await http()
        .patch(`/api/v1/bloqueos/${creado.bloqueo.id}`)
        .set('Cookie', sesion.cookie)
        .send({ fin: '2026-11-25T09:00:00Z' })
        .expect(400);
      expect(errorApiSchema.parse(resFinInvalido.body).codigo).toBe('VALIDACION');

      // Actualización válida
      const resPatch = await http()
        .patch(`/api/v1/bloqueos/${creado.bloqueo.id}`)
        .set('Cookie', sesion.cookie)
        .send({ fin: '2026-11-25T14:00:00Z', motivo: 'Feriado local' })
        .expect(200);
      const actualizado = resultadoBloqueoSchema.parse(resPatch.body);
      expect(actualizado.bloqueo.fin).toBe('2026-11-25T14:00:00.000Z');
      expect(actualizado.bloqueo.motivo).toBe('Feriado local');

      await http()
        .delete(`/api/v1/bloqueos/${creado.bloqueo.id}`)
        .set('Cookie', sesion.cookie)
        .expect(204);

      const resLista = await http()
        .get('/api/v1/bloqueos')
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(resLista.body).toEqual([]);
    });

    it('cuenta reservas activas afectadas (incluyendo margen posterior), ignora canceladas y distingue bloqueo de profesional vs empresa', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const servicio = await crearServicio(prueba.db, { empresaId: sesion.empresa.id });
      const cliente = await crearCliente(prueba.db, { empresaId: sesion.empresa.id });
      const prof1 = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });
      const prof2 = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });

      // 1. Reserva activa de prof1 dentro del bloqueo (10:30 - 11:00) -> cuenta
      await crearReserva(prueba.db, {
        empresaId: sesion.empresa.id,
        servicioId: servicio.id,
        profesionalId: prof1.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-11-26T10:30:00Z'),
        estado: 'confirmada',
      });

      // 2. Reserva de prof1 cuyo servicio termina a las 10:00 pero su bloqueoHasta llega a 10:15 -> cuenta
      await crearReserva(prueba.db, {
        empresaId: sesion.empresa.id,
        servicioId: servicio.id,
        profesionalId: prof1.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-11-26T09:30:00Z'),
        fechaHoraFin: new Date('2026-11-26T10:00:00Z'),
        bloqueoHasta: new Date('2026-11-26T10:15:00Z'),
        estado: 'pendiente',
      });

      // 3. Reserva cancelada de prof1 dentro del rango -> NO cuenta
      await crearReserva(prueba.db, {
        empresaId: sesion.empresa.id,
        servicioId: servicio.id,
        profesionalId: prof1.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-11-26T11:00:00Z'),
        estado: 'cancelada',
      });

      // 4. Reserva contigua de prof1 justo al final (12:00 - 12:30) -> NO cuenta
      await crearReserva(prueba.db, {
        empresaId: sesion.empresa.id,
        servicioId: servicio.id,
        profesionalId: prof1.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-11-26T12:00:00Z'),
        estado: 'confirmada',
      });

      // 5. Reserva activa de prof2 dentro del rango -> cuenta solo en bloqueo de empresa
      await crearReserva(prueba.db, {
        empresaId: sesion.empresa.id,
        servicioId: servicio.id,
        profesionalId: prof2.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-11-26T10:30:00Z'),
        estado: 'confirmada',
      });

      // Bloqueo para prof1 [10:00, 12:00): afecta 2 reservas de prof1
      const resProf1 = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesion.cookie)
        .send({
          profesionalId: prof1.id,
          inicio: '2026-11-26T10:00:00Z',
          fin: '2026-11-26T12:00:00Z',
        })
        .expect(201);
      expect(resultadoBloqueoSchema.parse(resProf1.body).reservasAfectadas).toBe(2);

      // Al extender el fin del bloqueo hasta 12:15 en PATCH, ahora incluye también la reserva #4 (total 3)
      const bloqueoProf1Id = resultadoBloqueoSchema.parse(resProf1.body).bloqueo.id;
      const resPatchProf1 = await http()
        .patch(`/api/v1/bloqueos/${bloqueoProf1Id}`)
        .set('Cookie', sesion.cookie)
        .send({ fin: '2026-11-26T12:15:00Z' })
        .expect(200);
      expect(resultadoBloqueoSchema.parse(resPatchProf1.body).reservasAfectadas).toBe(3);

      // Bloqueo de empresa [10:00, 12:00): afecta 2 de prof1 + 1 de prof2 = 3 reservas
      const resEmpresa = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesion.cookie)
        .send({
          profesionalId: null,
          inicio: '2026-11-26T10:00:00Z',
          fin: '2026-11-26T12:00:00Z',
        })
        .expect(201);
      expect(resultadoBloqueoSchema.parse(resEmpresa.body).reservasAfectadas).toBe(3);
    });
  });

  describe('aislamiento multiempresa', () => {
    it('responde 404 NO_ENCONTRADO al operar sobre profesionales o bloqueos de otra empresa', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const profB = await crearProfesional(prueba.db, { empresaId: sesionB.empresa.id });
      const bloqueoB = await crearBloqueo(prueba.db, {
        empresaId: sesionB.empresa.id,
        profesionalId: profB.id,
        inicio: new Date('2026-11-27T10:00:00Z'),
        fin: new Date('2026-11-27T12:00:00Z'),
      });

      const resListaA = await http()
        .get('/api/v1/bloqueos')
        .set('Cookie', sesionA.cookie)
        .expect(200);
      expect(resListaA.body).toEqual([]);

      const resCrearConProfAjeno = await http()
        .post('/api/v1/bloqueos')
        .set('Cookie', sesionA.cookie)
        .send({
          profesionalId: profB.id,
          inicio: '2026-11-27T10:00:00Z',
          fin: '2026-11-27T12:00:00Z',
        })
        .expect(404);
      expect(errorApiSchema.parse(resCrearConProfAjeno.body).codigo).toBe('NO_ENCONTRADO');

      const resPatchAjeno = await http()
        .patch(`/api/v1/bloqueos/${bloqueoB.id}`)
        .set('Cookie', sesionA.cookie)
        .send({ motivo: 'Ajeno' })
        .expect(404);
      expect(errorApiSchema.parse(resPatchAjeno.body).codigo).toBe('NO_ENCONTRADO');

      const resDeleteAjeno = await http()
        .delete(`/api/v1/bloqueos/${bloqueoB.id}`)
        .set('Cookie', sesionA.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resDeleteAjeno.body).codigo).toBe('NO_ENCONTRADO');
    });
  });
});
