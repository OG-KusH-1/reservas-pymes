import { randomUUID } from 'node:crypto';
import { errorApiSchema, paginaProfesionalesSchema, profesionalSchema } from '@portfolio/contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { profesionalesServicios } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import {
  asignarServicioAProfesional,
  crearCliente,
  crearMiembro,
  crearProfesional,
  crearReserva,
  crearServicio,
  crearSesionDePrueba,
  crearUsuario,
} from './fabricas.js';

describe('profesionales y asignación de servicios (integración)', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });

  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  const http = () => request(prueba.app.getHttpServer());

  describe('autenticación y permisos por rol', () => {
    it('rechaza peticiones sin sesión con 401 NO_AUTENTICADO', async () => {
      const id = randomUUID();
      const res = await http().get('/api/v1/profesionales').expect(401);
      expect(errorApiSchema.parse(res.body).codigo).toBe('NO_AUTENTICADO');

      await http().get(`/api/v1/profesionales/${id}`).expect(401);
      await http().post('/api/v1/profesionales').send({ nombre: 'Ana' }).expect(401);
      await http().patch(`/api/v1/profesionales/${id}`).send({ nombre: 'Ana' }).expect(401);
      await http().delete(`/api/v1/profesionales/${id}`).expect(401);
      await http()
        .put(`/api/v1/profesionales/${id}/servicios`)
        .send({ servicioIds: [] })
        .expect(401);
      await http().put(`/api/v1/profesionales/${id}/usuario`).send({ usuarioId: null }).expect(401);
    });

    it('permite lectura a recepcion y profesional, pero bloquea escritura con 403 SIN_PERMISO', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const profesional = await crearProfesional(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        nombre: 'Camila Soto',
      });

      for (const rol of ['recepcion', 'profesional'] as const) {
        const sesion = await crearSesionDePrueba(prueba, { rol });
        const profEmpresa = await crearProfesional(prueba.db, {
          empresaId: sesion.empresa.id,
          nombre: 'Lucía Vera',
        });

        await http().get('/api/v1/profesionales').set('Cookie', sesion.cookie).expect(200);
        await http()
          .get(`/api/v1/profesionales/${profEmpresa.id}`)
          .set('Cookie', sesion.cookie)
          .expect(200);

        const resCrear = await http()
          .post('/api/v1/profesionales')
          .set('Cookie', sesion.cookie)
          .send({ nombre: 'Nuevo' })
          .expect(403);
        expect(errorApiSchema.parse(resCrear.body).codigo).toBe('SIN_PERMISO');

        const resEditar = await http()
          .patch(`/api/v1/profesionales/${profEmpresa.id}`)
          .set('Cookie', sesion.cookie)
          .send({ nombre: 'Editado' })
          .expect(403);
        expect(errorApiSchema.parse(resEditar.body).codigo).toBe('SIN_PERMISO');

        await http()
          .delete(`/api/v1/profesionales/${profEmpresa.id}`)
          .set('Cookie', sesion.cookie)
          .expect(403);

        await http()
          .put(`/api/v1/profesionales/${profEmpresa.id}/servicios`)
          .set('Cookie', sesion.cookie)
          .send({ servicioIds: [] })
          .expect(403);

        await http()
          .put(`/api/v1/profesionales/${profEmpresa.id}/usuario`)
          .set('Cookie', sesion.cookie)
          .send({ usuarioId: null })
          .expect(403);
      }

      // Evita warning de variable no usada si cambia la prueba.
      expect(profesional.id).toBeDefined();
    });

    it('permite crear y editar tanto a dueno como a admin', async () => {
      for (const rol of ['dueno', 'admin'] as const) {
        const sesion = await crearSesionDePrueba(prueba, { rol });
        const res = await http()
          .post('/api/v1/profesionales')
          .set('Cookie', sesion.cookie)
          .send({ nombre: `Profesional ${rol}` })
          .expect(201);

        const creado = profesionalSchema.parse(res.body);
        expect(creado.nombre).toBe(`Profesional ${rol}`);

        await http()
          .patch(`/api/v1/profesionales/${creado.id}`)
          .set('Cookie', sesion.cookie)
          .send({ activo: false })
          .expect(200);
      }
    });
  });

  describe('CRUD básico y validaciones', () => {
    it('crea, obtiene, actualiza y elimina un profesional sin reservas', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const resCrear = await http()
        .post('/api/v1/profesionales')
        .set('Cookie', sesion.cookie)
        .send({
          nombre: '  Valentina Rojas  ',
          email: 'VALENTINA@Example.com',
          telefono: '+56912345678',
          activo: true,
        })
        .expect(201);

      const creado = profesionalSchema.parse(resCrear.body);
      expect(creado).toMatchObject({
        usuarioId: null,
        nombre: 'Valentina Rojas',
        email: 'valentina@example.com',
        telefono: '+56912345678',
        activo: true,
        servicios: [],
      });

      const resObtener = await http()
        .get(`/api/v1/profesionales/${creado.id}`)
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(profesionalSchema.parse(resObtener.body).id).toBe(creado.id);

      const resActualizar = await http()
        .patch(`/api/v1/profesionales/${creado.id}`)
        .set('Cookie', sesion.cookie)
        .send({ email: null, activo: false })
        .expect(200);

      const actualizado = profesionalSchema.parse(resActualizar.body);
      expect(actualizado.email).toBeNull();
      expect(actualizado.activo).toBe(false);
      expect(actualizado.telefono).toBe('+56912345678');

      await http()
        .delete(`/api/v1/profesionales/${creado.id}`)
        .set('Cookie', sesion.cookie)
        .expect(204);

      const resDespues = await http()
        .get(`/api/v1/profesionales/${creado.id}`)
        .set('Cookie', sesion.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resDespues.body).codigo).toBe('NO_ENCONTRADO');
    });

    it('rechaza entradas inválidas con 400 VALIDACION y UUID malformado con 404 NO_ENCONTRADO', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const profesional = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });

      const resCrearInvalido = await http()
        .post('/api/v1/profesionales')
        .set('Cookie', sesion.cookie)
        .send({ nombre: 'A' })
        .expect(400);
      expect(errorApiSchema.parse(resCrearInvalido.body).codigo).toBe('VALIDACION');

      const resPatchVacio = await http()
        .patch(`/api/v1/profesionales/${profesional.id}`)
        .set('Cookie', sesion.cookie)
        .send({})
        .expect(400);
      expect(errorApiSchema.parse(resPatchVacio.body).codigo).toBe('VALIDACION');

      const resIdInvalido = await http()
        .get('/api/v1/profesionales/no-es-uuid')
        .set('Cookie', sesion.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resIdInvalido.body).codigo).toBe('NO_ENCONTRADO');
    });

    it('rechaza eliminar un profesional que tiene reservas con 409 CONFLICTO', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const profesional = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });
      const servicio = await crearServicio(prueba.db, { empresaId: sesion.empresa.id });
      const cliente = await crearCliente(prueba.db, { empresaId: sesion.empresa.id });

      await crearReserva(prueba.db, {
        empresaId: sesion.empresa.id,
        profesionalId: profesional.id,
        servicioId: servicio.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-12-01T14:00:00Z'),
      });

      const res = await http()
        .delete(`/api/v1/profesionales/${profesional.id}`)
        .set('Cookie', sesion.cookie)
        .expect(409);

      const error = errorApiSchema.parse(res.body);
      expect(error.codigo).toBe('CONFLICTO');
    });
  });

  describe('listado, filtros y paginación por cursor', () => {
    it('pagina de forma estable por (nombre, id) incluso con nombres repetidos y adjunta servicios', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaId = sesion.empresa.id;

      const s1 = await crearServicio(prueba.db, { empresaId, nombre: 'Barba', color: '#111111' });
      const s2 = await crearServicio(prueba.db, { empresaId, nombre: 'Corte', color: '#222222' });

      const p1 = await crearProfesional(prueba.db, { empresaId, nombre: 'Ana' });
      const p2 = await crearProfesional(prueba.db, { empresaId, nombre: 'Ana' });
      const p3 = await crearProfesional(prueba.db, { empresaId, nombre: 'Bruno' });
      const p4 = await crearProfesional(prueba.db, { empresaId, nombre: 'Carla' });

      await asignarServicioAProfesional(prueba.db, {
        empresaId,
        profesionalId: p1.id,
        servicioId: s2.id,
      });
      await asignarServicioAProfesional(prueba.db, {
        empresaId,
        profesionalId: p1.id,
        servicioId: s1.id,
      });

      const recibidos: string[] = [];
      let cursor: string | null = null;
      let paginas = 0;

      do {
        const query = cursor ? `?limite=2&cursor=${encodeURIComponent(cursor)}` : '?limite=2';
        const res = await http()
          .get(`/api/v1/profesionales${query}`)
          .set('Cookie', sesion.cookie)
          .expect(200);

        const pagina = paginaProfesionalesSchema.parse(res.body);
        paginas++;
        for (const item of pagina.datos) {
          recibidos.push(item.id);
          if (item.id === p1.id) {
            expect(item.servicios.map((s) => s.nombre)).toEqual(['Barba', 'Corte']);
          }
        }
        cursor = pagina.siguienteCursor;
      } while (cursor !== null);

      expect(paginas).toBe(2);
      expect(recibidos).toHaveLength(4);
      expect(new Set(recibidos)).toEqual(new Set([p1.id, p2.id, p3.id, p4.id]));
    });

    it('filtra por activo, búsqueda q y servicioId sin duplicar filas', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaId = sesion.empresa.id;

      const corte = await crearServicio(prueba.db, { empresaId, nombre: 'Corte' });
      const color = await crearServicio(prueba.db, { empresaId, nombre: 'Coloración' });

      const activoConCorte = await crearProfesional(prueba.db, {
        empresaId,
        nombre: 'Sofía Mendez',
        email: 'sofia@salon.cl',
        activo: true,
      });
      const inactivoConCorte = await crearProfesional(prueba.db, {
        empresaId,
        nombre: 'Diego Paredes',
        email: 'diego@salon.cl',
        activo: false,
      });
      const activoSinCorte = await crearProfesional(prueba.db, {
        empresaId,
        nombre: 'Elena Cruz',
        email: 'elena.mendez@salon.cl',
        activo: true,
      });

      await asignarServicioAProfesional(prueba.db, {
        empresaId,
        profesionalId: activoConCorte.id,
        servicioId: corte.id,
      });
      await asignarServicioAProfesional(prueba.db, {
        empresaId,
        profesionalId: inactivoConCorte.id,
        servicioId: corte.id,
      });
      await asignarServicioAProfesional(prueba.db, {
        empresaId,
        profesionalId: activoSinCorte.id,
        servicioId: color.id,
      });

      const resActivos = await http()
        .get('/api/v1/profesionales?activo=true')
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(paginaProfesionalesSchema.parse(resActivos.body).datos.map((p) => p.id)).toEqual([
        activoSinCorte.id,
        activoConCorte.id,
      ]);

      const resServicio = await http()
        .get(`/api/v1/profesionales?servicioId=${corte.id}&activo=true`)
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(paginaProfesionalesSchema.parse(resServicio.body).datos.map((p) => p.id)).toEqual([
        activoConCorte.id,
      ]);

      const resBusqueda = await http()
        .get('/api/v1/profesionales?q=MENDEZ')
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(paginaProfesionalesSchema.parse(resBusqueda.body).datos.map((p) => p.id)).toEqual([
        activoSinCorte.id,
        activoConCorte.id,
      ]);
    });

    it('rechaza un cursor malformado con 400 VALIDACION', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const res = await http()
        .get('/api/v1/profesionales?cursor=cursor-invalido')
        .set('Cookie', sesion.cookie)
        .expect(400);

      expect(errorApiSchema.parse(res.body).codigo).toBe('VALIDACION');
    });
  });

  describe('asignación de servicios (PUT /profesionales/:id/servicios)', () => {
    it('reemplaza la lista de servicios de forma atómica y permite vaciarla', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'admin' });
      const empresaId = sesion.empresa.id;

      const prof = await crearProfesional(prueba.db, { empresaId });
      const s1 = await crearServicio(prueba.db, { empresaId, nombre: 'Alisado' });
      const s2 = await crearServicio(prueba.db, { empresaId, nombre: 'Peinado' });
      const s3 = await crearServicio(prueba.db, { empresaId, nombre: 'Tintura' });

      const res1 = await http()
        .put(`/api/v1/profesionales/${prof.id}/servicios`)
        .set('Cookie', sesion.cookie)
        .send({ servicioIds: [s2.id, s1.id, s2.id] })
        .expect(200);

      expect(profesionalSchema.parse(res1.body).servicios.map((s) => s.id)).toEqual([s1.id, s2.id]);

      const res2 = await http()
        .put(`/api/v1/profesionales/${prof.id}/servicios`)
        .set('Cookie', sesion.cookie)
        .send({ servicioIds: [s3.id] })
        .expect(200);

      expect(profesionalSchema.parse(res2.body).servicios.map((s) => s.id)).toEqual([s3.id]);

      const resVacio = await http()
        .put(`/api/v1/profesionales/${prof.id}/servicios`)
        .set('Cookie', sesion.cookie)
        .send({ servicioIds: [] })
        .expect(200);

      expect(profesionalSchema.parse(resVacio.body).servicios).toEqual([]);
    });

    it('rechaza con 404 si algún servicio no existe o pertenece a otra empresa sin perder la asignación previa', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const profA = await crearProfesional(prueba.db, { empresaId: sesionA.empresa.id });
      const servicioA = await crearServicio(prueba.db, { empresaId: sesionA.empresa.id });
      const servicioB = await crearServicio(prueba.db, { empresaId: sesionB.empresa.id });

      await asignarServicioAProfesional(prueba.db, {
        empresaId: sesionA.empresa.id,
        profesionalId: profA.id,
        servicioId: servicioA.id,
      });

      const resInexistente = await http()
        .put(`/api/v1/profesionales/${profA.id}/servicios`)
        .set('Cookie', sesionA.cookie)
        .send({ servicioIds: [randomUUID()] })
        .expect(404);
      expect(errorApiSchema.parse(resInexistente.body).codigo).toBe('NO_ENCONTRADO');

      const resAjeno = await http()
        .put(`/api/v1/profesionales/${profA.id}/servicios`)
        .set('Cookie', sesionA.cookie)
        .send({ servicioIds: [servicioA.id, servicioB.id] })
        .expect(404);
      expect(errorApiSchema.parse(resAjeno.body).codigo).toBe('NO_ENCONTRADO');

      const filas = await prueba.db
        .select()
        .from(profesionalesServicios)
        .where(
          and(
            eq(profesionalesServicios.empresaId, sesionA.empresa.id),
            eq(profesionalesServicios.profesionalId, profA.id),
          ),
        );
      expect(filas.map((f) => f.servicioId)).toEqual([servicioA.id]);
    });
  });

  describe('vínculo con usuario miembro (PUT /profesionales/:id/usuario)', () => {
    it('vincula un miembro válido, es idempotente y desvincula con null', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaId = sesion.empresa.id;

      const prof = await crearProfesional(prueba.db, { empresaId });
      const usuario = await crearUsuario(prueba.db);
      await crearMiembro(prueba.db, { empresaId, usuarioId: usuario.id, rol: 'profesional' });

      const resVincular = await http()
        .put(`/api/v1/profesionales/${prof.id}/usuario`)
        .set('Cookie', sesion.cookie)
        .send({ usuarioId: usuario.id })
        .expect(200);
      expect(profesionalSchema.parse(resVincular.body).usuarioId).toBe(usuario.id);

      const resReasignarMismo = await http()
        .put(`/api/v1/profesionales/${prof.id}/usuario`)
        .set('Cookie', sesion.cookie)
        .send({ usuarioId: usuario.id })
        .expect(200);
      expect(profesionalSchema.parse(resReasignarMismo.body).usuarioId).toBe(usuario.id);

      const resDesvincular = await http()
        .put(`/api/v1/profesionales/${prof.id}/usuario`)
        .set('Cookie', sesion.cookie)
        .send({ usuarioId: null })
        .expect(200);
      expect(profesionalSchema.parse(resDesvincular.body).usuarioId).toBeNull();
    });

    it('rechaza con 404 si el usuario no es miembro de la empresa', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const prof = await crearProfesional(prueba.db, { empresaId: sesion.empresa.id });
      const usuarioExterno = await crearUsuario(prueba.db);

      const res = await http()
        .put(`/api/v1/profesionales/${prof.id}/usuario`)
        .set('Cookie', sesion.cookie)
        .send({ usuarioId: usuarioExterno.id })
        .expect(404);

      expect(errorApiSchema.parse(res.body).codigo).toBe('NO_ENCONTRADO');
    });

    it('rechaza con 409 CONFLICTO si el usuario ya está vinculado a otro profesional de la misma empresa, pero permite vincularlo en otra empresa', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const usuarioCompartido = await crearUsuario(prueba.db);
      await crearMiembro(prueba.db, {
        empresaId: sesionA.empresa.id,
        usuarioId: usuarioCompartido.id,
        rol: 'profesional',
      });
      await crearMiembro(prueba.db, {
        empresaId: sesionB.empresa.id,
        usuarioId: usuarioCompartido.id,
        rol: 'profesional',
      });

      const profA1 = await crearProfesional(prueba.db, { empresaId: sesionA.empresa.id });
      const profA2 = await crearProfesional(prueba.db, { empresaId: sesionA.empresa.id });
      const profB1 = await crearProfesional(prueba.db, { empresaId: sesionB.empresa.id });

      await http()
        .put(`/api/v1/profesionales/${profA1.id}/usuario`)
        .set('Cookie', sesionA.cookie)
        .send({ usuarioId: usuarioCompartido.id })
        .expect(200);

      const resConflicto = await http()
        .put(`/api/v1/profesionales/${profA2.id}/usuario`)
        .set('Cookie', sesionA.cookie)
        .send({ usuarioId: usuarioCompartido.id })
        .expect(409);
      expect(errorApiSchema.parse(resConflicto.body).codigo).toBe('CONFLICTO');

      const resOtraEmpresa = await http()
        .put(`/api/v1/profesionales/${profB1.id}/usuario`)
        .set('Cookie', sesionB.cookie)
        .send({ usuarioId: usuarioCompartido.id })
        .expect(200);
      expect(profesionalSchema.parse(resOtraEmpresa.body).usuarioId).toBe(usuarioCompartido.id);
    });
  });

  describe('aislamiento multiempresa', () => {
    it('impide leer, modificar, asignar servicios, vincular usuario o eliminar profesionales de otra empresa (404 NO_ENCONTRADO)', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const profB = await crearProfesional(prueba.db, {
        empresaId: sesionB.empresa.id,
        nombre: 'Profesional B',
      });
      const servicioA = await crearServicio(prueba.db, { empresaId: sesionA.empresa.id });

      const resListaA = await http()
        .get('/api/v1/profesionales')
        .set('Cookie', sesionA.cookie)
        .expect(200);
      expect(paginaProfesionalesSchema.parse(resListaA.body).datos).toEqual([]);

      await http()
        .get(`/api/v1/profesionales/${profB.id}`)
        .set('Cookie', sesionA.cookie)
        .expect(404);

      await http()
        .patch(`/api/v1/profesionales/${profB.id}`)
        .set('Cookie', sesionA.cookie)
        .send({ nombre: 'Secuestrado' })
        .expect(404);

      await http()
        .put(`/api/v1/profesionales/${profB.id}/servicios`)
        .set('Cookie', sesionA.cookie)
        .send({ servicioIds: [servicioA.id] })
        .expect(404);

      await http()
        .put(`/api/v1/profesionales/${profB.id}/usuario`)
        .set('Cookie', sesionA.cookie)
        .send({ usuarioId: sesionA.usuario.id })
        .expect(404);

      await http()
        .delete(`/api/v1/profesionales/${profB.id}`)
        .set('Cookie', sesionA.cookie)
        .expect(404);
    });
  });
});
