import { randomBytes, randomUUID } from 'node:crypto';
import { errorApiSchema, tramoHorarioSchema, type RolMiembro } from '@portfolio/contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COOKIE_SESION } from '../src/app.setup.js';
import { hashTokenSesion } from '../src/auth/session.service.js';
import { horarios, sesiones } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import {
  crearHorario,
  crearMiembro,
  crearProfesional,
  crearSesionDePrueba,
  crearUsuario,
} from './fabricas.js';

describe('horarios semanales por profesional (integración)', () => {
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

      const resGet = await http().get(`/api/v1/profesionales/${id}/horarios`).expect(401);
      expect(errorApiSchema.parse(resGet.body).codigo).toBe('NO_AUTENTICADO');

      const resPut = await http()
        .put(`/api/v1/profesionales/${id}/horarios`)
        .send({ tramos: [] })
        .expect(401);
      expect(errorApiSchema.parse(resPut.body).codigo).toBe('NO_AUTENTICADO');
    });

    it('permite lectura a recepcion, pero bloquea edición con 403 SIN_PERMISO', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionRecepcion = await crearSesionEnEmpresa(sesionDueno.empresa.id, 'recepcion');
      const profesional = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
      });

      await http()
        .get(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesionRecepcion.cookie)
        .expect(200);

      const resPut = await http()
        .put(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesionRecepcion.cookie)
        .send({ tramos: [] })
        .expect(403);
      expect(errorApiSchema.parse(resPut.body).codigo).toBe('SIN_PERMISO');
    });

    it('permite a un profesional editar solo sus propios horarios y rechaza los ajenos con 403', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionProf = await crearSesionEnEmpresa(sesionDueno.empresa.id, 'profesional');
      const sesionOtroUsuario = await crearSesionEnEmpresa(sesionDueno.empresa.id, 'profesional');

      const propio = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        usuarioId: sesionProf.usuario.id,
      });
      const ajenoSinUsuario = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
      });
      const ajenoConOtroUsuario = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        usuarioId: sesionOtroUsuario.usuario.id,
      });

      // Puede leer los de otros profesionales de la empresa
      await http()
        .get(`/api/v1/profesionales/${ajenoSinUsuario.id}/horarios`)
        .set('Cookie', sesionProf.cookie)
        .expect(200);

      // Puede editar los suyos propios
      const resPropio = await http()
        .put(`/api/v1/profesionales/${propio.id}/horarios`)
        .set('Cookie', sesionProf.cookie)
        .send({
          tramos: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00', activo: true }],
        })
        .expect(200);
      expect(resPropio.body).toHaveLength(1);

      // No puede editar los de otro profesional (sin usuario o con otro usuario)
      const resSinUsuario = await http()
        .put(`/api/v1/profesionales/${ajenoSinUsuario.id}/horarios`)
        .set('Cookie', sesionProf.cookie)
        .send({ tramos: [] })
        .expect(403);
      expect(errorApiSchema.parse(resSinUsuario.body).codigo).toBe('SIN_PERMISO');

      const resOtroUsuario = await http()
        .put(`/api/v1/profesionales/${ajenoConOtroUsuario.id}/horarios`)
        .set('Cookie', sesionProf.cookie)
        .send({ tramos: [] })
        .expect(403);
      expect(errorApiSchema.parse(resOtroUsuario.body).codigo).toBe('SIN_PERMISO');
    });
  });

  describe('consulta y reemplazo atómico de horarios', () => {
    it('devuelve lista vacía inicialmente, guarda tramos contiguos ordenados y reemplaza la semana completa', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'admin' });
      const profesional = await crearProfesional(prueba.db, {
        empresaId: sesion.empresa.id,
      });

      const resInicial = await http()
        .get(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(resInicial.body).toEqual([]);

      // Envía días y tramos desordenados, incluyendo tramos contiguos 09:00–13:00 y 13:00–18:00
      const resPrimerPut = await http()
        .put(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .send({
          tramos: [
            { diaSemana: 3, horaInicio: '10:00', horaFin: '14:00', activo: false },
            { diaSemana: 1, horaInicio: '13:00', horaFin: '18:00', activo: true },
            { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00', activo: true },
          ],
        })
        .expect(200);

      const guardados = tramoHorarioSchema.array().parse(resPrimerPut.body);
      expect(guardados).toHaveLength(3);
      expect(
        guardados.map((t) => ({
          dia: t.diaSemana,
          inicio: t.horaInicio,
          fin: t.horaFin,
          activo: t.activo,
        })),
      ).toEqual([
        { dia: 1, inicio: '09:00', fin: '13:00', activo: true },
        { dia: 1, inicio: '13:00', fin: '18:00', activo: true },
        { dia: 3, inicio: '10:00', fin: '14:00', activo: false },
      ]);

      // GET devuelve el mismo orden y formato HH:mm
      const resGet = await http()
        .get(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(tramoHorarioSchema.array().parse(resGet.body)).toEqual(guardados);

      // Segundo PUT reemplaza con otro conjunto
      const resSegundoPut = await http()
        .put(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .send({
          tramos: [{ diaSemana: 5, horaInicio: '08:30', horaFin: '12:30' }],
        })
        .expect(200);

      const reemplazados = tramoHorarioSchema.array().parse(resSegundoPut.body);
      expect(reemplazados).toHaveLength(1);
      expect(reemplazados[0]?.diaSemana).toBe(5);
      expect(reemplazados[0]?.activo).toBe(true);

      // Tercer PUT con semana vacía limpia los tramos en base de datos
      const resVacio = await http()
        .put(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .send({ tramos: [] })
        .expect(200);
      expect(resVacio.body).toEqual([]);

      const filasEnDb = await prueba.db
        .select()
        .from(horarios)
        .where(
          and(
            eq(horarios.empresaId, sesion.empresa.id),
            eq(horarios.profesionalId, profesional.id),
          ),
        );
      expect(filasEnDb).toHaveLength(0);
    });

    it('rechaza tramos solapados en el mismo día y tramos con horaInicio >= horaFin sin alterar los previos', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const profesional = await crearProfesional(prueba.db, {
        empresaId: sesion.empresa.id,
      });
      await crearHorario(prueba.db, {
        empresaId: sesion.empresa.id,
        profesionalId: profesional.id,
        diaSemana: 2,
        horaInicio: '09:00',
        horaFin: '12:00',
      });

      const resSolapado = await http()
        .put(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .send({
          tramos: [
            { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
            { diaSemana: 1, horaInicio: '12:30', horaFin: '16:00' },
          ],
        })
        .expect(400);
      expect(errorApiSchema.parse(resSolapado.body).codigo).toBe('VALIDACION');

      const resRangoInvalido = await http()
        .put(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .send({
          tramos: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '14:00' }],
        })
        .expect(400);
      expect(errorApiSchema.parse(resRangoInvalido.body).codigo).toBe('VALIDACION');

      // Verifica que el horario previo sigue intacto
      const resGet = await http()
        .get(`/api/v1/profesionales/${profesional.id}/horarios`)
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(resGet.body).toHaveLength(1);
      expect(resGet.body[0].diaSemana).toBe(2);
    });
  });

  describe('aislamiento multiempresa', () => {
    it('responde 404 NO_ENCONTRADO al consultar o modificar horarios de un profesional de otra empresa', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const profB = await crearProfesional(prueba.db, { empresaId: sesionB.empresa.id });

      const resGet = await http()
        .get(`/api/v1/profesionales/${profB.id}/horarios`)
        .set('Cookie', sesionA.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resGet.body).codigo).toBe('NO_ENCONTRADO');

      const resPut = await http()
        .put(`/api/v1/profesionales/${profB.id}/horarios`)
        .set('Cookie', sesionA.cookie)
        .send({ tramos: [] })
        .expect(404);
      expect(errorApiSchema.parse(resPut.body).codigo).toBe('NO_ENCONTRADO');

      await http()
        .get('/api/v1/profesionales/no-es-uuid/horarios')
        .set('Cookie', sesionA.cookie)
        .expect(404);
    });
  });
});
