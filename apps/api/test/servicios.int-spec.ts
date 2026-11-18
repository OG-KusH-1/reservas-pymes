import { errorApiSchema, paginaServiciosSchema, servicioSchema } from '@portfolio/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import {
  crearCliente,
  crearEmpresa,
  crearProfesional,
  crearReserva,
  crearServicio,
  crearSesionDePrueba,
} from './fabricas.js';

describe('servicios (integración)', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });

  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  const http = () => request(prueba.app.getHttpServer());

  describe('autenticación y permisos por rol', () => {
    it('rechaza con 401 NO_AUTENTICADO cuando no hay sesión activa', async () => {
      const idFalso = '00000000-0000-4000-8000-000000000001';

      for (const req of [
        http().get('/api/v1/servicios'),
        http().get(`/api/v1/servicios/${idFalso}`),
        http().post('/api/v1/servicios').send({ nombre: 'Corte' }),
        http().patch(`/api/v1/servicios/${idFalso}`).send({ nombre: 'Corte' }),
        http().delete(`/api/v1/servicios/${idFalso}`),
      ]) {
        const res = await req.expect(401);
        expect(errorApiSchema.parse(res.body).codigo).toBe('NO_AUTENTICADO');
      }
    });

    it('permite leer a recepcion y profesional, pero les rechaza escribir con 403 SIN_PERMISO', async () => {
      for (const rol of ['recepcion', 'profesional'] as const) {
        const sesion = await crearSesionDePrueba(prueba, { rol });
        const servicio = await crearServicio(prueba.db, {
          empresaId: sesion.empresa.id,
          nombre: `Servicio ${rol}`,
        });

        const resListado = await http()
          .get('/api/v1/servicios')
          .set('Cookie', sesion.cookie)
          .expect(200);
        expect(paginaServiciosSchema.parse(resListado.body).datos).toHaveLength(1);

        const resDetalle = await http()
          .get(`/api/v1/servicios/${servicio.id}`)
          .set('Cookie', sesion.cookie)
          .expect(200);
        expect(servicioSchema.parse(resDetalle.body).id).toBe(servicio.id);

        const resCrear = await http()
          .post('/api/v1/servicios')
          .set('Cookie', sesion.cookie)
          .send({ nombre: 'Intento Crear' })
          .expect(403);
        expect(errorApiSchema.parse(resCrear.body).codigo).toBe('SIN_PERMISO');

        const resActualizar = await http()
          .patch(`/api/v1/servicios/${servicio.id}`)
          .set('Cookie', sesion.cookie)
          .send({ nombre: 'Intento Editar' })
          .expect(403);
        expect(errorApiSchema.parse(resActualizar.body).codigo).toBe('SIN_PERMISO');

        const resEliminar = await http()
          .delete(`/api/v1/servicios/${servicio.id}`)
          .set('Cookie', sesion.cookie)
          .expect(403);
        expect(errorApiSchema.parse(resEliminar.body).codigo).toBe('SIN_PERMISO');
      }
    });
  });

  describe('CRUD y validaciones', () => {
    it('permite crear, leer, actualizar y eliminar un servicio como dueno y admin', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const resCrear = await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesionDueno.cookie)
        .send({
          nombre: 'Corte clásico',
          descripcion: 'Corte con tijera y máquina',
          categoria: 'Peluquería',
          duracionMinutos: 45,
          margenPosteriorMinutos: 15,
          precio: 15000,
          visiblePublico: true,
          color: '#1A2B3C',
          activo: true,
        })
        .expect(201);

      const creado = servicioSchema.parse(resCrear.body);
      expect(creado).toMatchObject({
        nombre: 'Corte clásico',
        descripcion: 'Corte con tijera y máquina',
        categoria: 'Peluquería',
        duracionMinutos: 45,
        margenPosteriorMinutos: 15,
        precio: 15000,
        visiblePublico: true,
        color: '#1A2B3C',
        activo: true,
      });

      const resObtener = await http()
        .get(`/api/v1/servicios/${creado.id}`)
        .set('Cookie', sesionDueno.cookie)
        .expect(200);
      expect(servicioSchema.parse(resObtener.body)).toEqual(creado);

      const resActualizar = await http()
        .patch(`/api/v1/servicios/${creado.id}`)
        .set('Cookie', sesionDueno.cookie)
        .send({
          precio: 18000,
          descripcion: null,
          color: '#ff00aa',
          visiblePublico: false,
        })
        .expect(200);

      expect(servicioSchema.parse(resActualizar.body)).toMatchObject({
        id: creado.id,
        nombre: 'Corte clásico',
        descripcion: null,
        precio: 18000,
        color: '#ff00aa',
        visiblePublico: false,
      });

      await http()
        .delete(`/api/v1/servicios/${creado.id}`)
        .set('Cookie', sesionDueno.cookie)
        .expect(204);

      const resPostBorrado = await http()
        .get(`/api/v1/servicios/${creado.id}`)
        .set('Cookie', sesionDueno.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resPostBorrado.body).codigo).toBe('NO_ENCONTRADO');

      // Verifica que admin también puede crear y eliminar.
      const sesionAdmin = await crearSesionDePrueba(prueba, { rol: 'admin' });
      const resAdmin = await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesionAdmin.cookie)
        .send({ nombre: 'Barba express' })
        .expect(201);
      const creadoAdmin = servicioSchema.parse(resAdmin.body);

      await http()
        .delete(`/api/v1/servicios/${creadoAdmin.id}`)
        .set('Cookie', sesionAdmin.cookie)
        .expect(204);
    });

    it.each([
      { caso: 'color sin almohadilla', cuerpo: { nombre: 'Corte', color: '112233' } },
      { caso: 'color con longitud incorrecta', cuerpo: { nombre: 'Corte', color: '#123' } },
      { caso: 'color con caracteres no hex', cuerpo: { nombre: 'Corte', color: '#GGGGGG' } },
      { caso: 'duracionMinutos igual a 0', cuerpo: { nombre: 'Corte', duracionMinutos: 0 } },
      { caso: 'duracionMinutos negativa', cuerpo: { nombre: 'Corte', duracionMinutos: -10 } },
      { caso: 'precio negativo', cuerpo: { nombre: 'Corte', precio: -1 } },
      {
        caso: 'margenPosteriorMinutos negativo',
        cuerpo: { nombre: 'Corte', margenPosteriorMinutos: -5 },
      },
      { caso: 'nombre demasiado corto', cuerpo: { nombre: 'A' } },
    ])('rechaza en POST con 400 VALIDACION cuando envía $caso', async ({ cuerpo }) => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const res = await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesion.cookie)
        .send(cuerpo)
        .expect(400);

      expect(errorApiSchema.parse(res.body).codigo).toBe('VALIDACION');
    });

    it.each([
      { caso: 'cuerpo vacío', cuerpo: {} },
      { caso: 'color inválido', cuerpo: { color: 'rojo' } },
      { caso: 'duracionMinutos <= 0', cuerpo: { duracionMinutos: 0 } },
      { caso: 'precio < 0', cuerpo: { precio: -100 } },
    ])('rechaza en PATCH con 400 VALIDACION cuando envía $caso', async ({ cuerpo }) => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const servicio = await crearServicio(prueba.db, { empresaId: sesion.empresa.id });

      const res = await http()
        .patch(`/api/v1/servicios/${servicio.id}`)
        .set('Cookie', sesion.cookie)
        .send(cuerpo)
        .expect(400);

      expect(errorApiSchema.parse(res.body).codigo).toBe('VALIDACION');
    });
  });

  describe('filtros y paginación por cursor', () => {
    it('filtra por activo, categoria y búsqueda q insensible a mayúsculas', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaId = sesion.empresa.id;

      await crearServicio(prueba.db, {
        empresaId,
        nombre: 'Masaje descontracturante',
        descripcion: 'Sesión de 60 minutos para espalda',
        categoria: 'Bienestar',
        activo: true,
      });
      await crearServicio(prueba.db, {
        empresaId,
        nombre: 'Corte infantil',
        descripcion: 'Para menores de 12 años',
        categoria: 'Peluquería',
        activo: true,
      });
      await crearServicio(prueba.db, {
        empresaId,
        nombre: 'Peinado antiguo',
        descripcion: 'Ya no se ofrece',
        categoria: 'Peluquería',
        activo: false,
      });

      const resActivos = await http()
        .get('/api/v1/servicios?activo=true')
        .set('Cookie', sesion.cookie)
        .expect(200);
      const paginaActivos = paginaServiciosSchema.parse(resActivos.body);
      expect(paginaActivos.datos.map((s) => s.nombre)).toEqual([
        'Corte infantil',
        'Masaje descontracturante',
      ]);

      const resInactivos = await http()
        .get('/api/v1/servicios?activo=false')
        .set('Cookie', sesion.cookie)
        .expect(200);
      const paginaInactivos = paginaServiciosSchema.parse(resInactivos.body);
      expect(paginaInactivos.datos.map((s) => s.nombre)).toEqual(['Peinado antiguo']);

      const resCategoria = await http()
        .get('/api/v1/servicios?categoria=Peluquer%C3%ADa&activo=true')
        .set('Cookie', sesion.cookie)
        .expect(200);
      const paginaCategoria = paginaServiciosSchema.parse(resCategoria.body);
      expect(paginaCategoria.datos.map((s) => s.nombre)).toEqual(['Corte infantil']);

      // Búsqueda por texto que coincide en descripción ("espalda") sin distinguir mayúsculas.
      const resBusqueda = await http()
        .get('/api/v1/servicios?q=ESPALDA')
        .set('Cookie', sesion.cookie)
        .expect(200);
      const paginaBusqueda = paginaServiciosSchema.parse(resBusqueda.body);
      expect(paginaBusqueda.datos.map((s) => s.nombre)).toEqual(['Masaje descontracturante']);
    });

    it('recorre todas las páginas con cursor estable sin duplicados ni omisiones', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaId = sesion.empresa.id;

      // Incluye dos servicios inactivos con el mismo nombre para probar el desempate por id.
      const nombres = ['Alfa', 'Bravo', 'Bravo', 'Charlie', 'Delta'];
      const creados = [];
      for (let i = 0; i < nombres.length; i++) {
        creados.push(
          await crearServicio(prueba.db, {
            empresaId,
            nombre: nombres[i]!,
            activo: i !== 2,
          }),
        );
      }

      const recolectados: string[] = [];
      let cursor: string | null = null;
      let iteraciones = 0;

      do {
        const url = cursor
          ? `/api/v1/servicios?limite=2&cursor=${encodeURIComponent(cursor)}`
          : '/api/v1/servicios?limite=2';
        const res = await http().get(url).set('Cookie', sesion.cookie).expect(200);
        const pagina = paginaServiciosSchema.parse(res.body);

        for (const item of pagina.datos) {
          recolectados.push(item.id);
        }
        cursor = pagina.siguienteCursor;
        iteraciones++;
      } while (cursor !== null && iteraciones < 10);

      expect(cursor).toBeNull();
      expect(iteraciones).toBe(3);
      expect(recolectados).toHaveLength(creados.length);
      expect(new Set(recolectados).size).toBe(creados.length);
    });

    it('rechaza con 400 VALIDACION un cursor mal formado', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      for (const cursorInvalido of ['no-es-base64-valido!!!', 'e30']) {
        const res = await http()
          .get(`/api/v1/servicios?cursor=${encodeURIComponent(cursorInvalido)}`)
          .set('Cookie', sesion.cookie)
          .expect(400);

        expect(errorApiSchema.parse(res.body).codigo).toBe('VALIDACION');
      }
    });
  });

  describe('unicidad de nombre entre servicios activos', () => {
    it('impide duplicar nombre entre activos pero permite inactivos homónimos y reactivación ordenada', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const resPrimero = await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesion.cookie)
        .send({ nombre: 'Limpieza facial', activo: true })
        .expect(201);
      const primero = servicioSchema.parse(resPrimero.body);

      // Segundo activo con el mismo nombre (distinto caso) → 409 CONFLICTO.
      const resDuplicado = await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesion.cookie)
        .send({ nombre: 'limpieza facial', activo: true })
        .expect(409);
      expect(errorApiSchema.parse(resDuplicado.body).codigo).toBe('CONFLICTO');

      // Inactivo con el mismo nombre → 201.
      const resInactivo = await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesion.cookie)
        .send({ nombre: 'Limpieza facial', activo: false })
        .expect(201);
      const inactivo = servicioSchema.parse(resInactivo.body);

      // Segundo inactivo con el mismo nombre → 201 también permitido.
      await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesion.cookie)
        .send({ nombre: 'Limpieza facial', activo: false })
        .expect(201);

      // Intentar activar el inactivo mientras el primero sigue activo → 409 CONFLICTO.
      const resActivarConflicto = await http()
        .patch(`/api/v1/servicios/${inactivo.id}`)
        .set('Cookie', sesion.cookie)
        .send({ activo: true })
        .expect(409);
      expect(errorApiSchema.parse(resActivarConflicto.body).codigo).toBe('CONFLICTO');

      // Desactivar el primero y luego activar el segundo → 200.
      await http()
        .patch(`/api/v1/servicios/${primero.id}`)
        .set('Cookie', sesion.cookie)
        .send({ activo: false })
        .expect(200);

      const resReactivado = await http()
        .patch(`/api/v1/servicios/${inactivo.id}`)
        .set('Cookie', sesion.cookie)
        .send({ activo: true })
        .expect(200);
      expect(servicioSchema.parse(resReactivado.body).activo).toBe(true);
    });
  });

  describe('protección al eliminar con reservas asociadas', () => {
    it('rechaza con 409 CONFLICTO indicando desactivar el servicio cuando tiene reservas', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaId = sesion.empresa.id;

      const servicio = await crearServicio(prueba.db, { empresaId, nombre: 'Servicio con cita' });
      const profesional = await crearProfesional(prueba.db, { empresaId });
      const cliente = await crearCliente(prueba.db, { empresaId });
      await crearReserva(prueba.db, {
        empresaId,
        servicioId: servicio.id,
        profesionalId: profesional.id,
        clienteId: cliente.id,
        fechaHoraInicio: new Date('2026-12-01T14:00:00Z'),
      });

      const res = await http()
        .delete(`/api/v1/servicios/${servicio.id}`)
        .set('Cookie', sesion.cookie)
        .expect(409);

      const error = errorApiSchema.parse(res.body);
      expect(error.codigo).toBe('CONFLICTO');
      expect(error.mensaje.toLowerCase()).toContain('desact');
    });
  });

  describe('aislamiento multiempresa', () => {
    it('impide leer, modificar o eliminar servicios de otra empresa y permite nombres iguales entre empresas', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const otraEmpresa = await crearEmpresa(prueba.db);

      const servicioA = await crearServicio(prueba.db, {
        empresaId: sesionA.empresa.id,
        nombre: 'Servicio Exclusivo',
      });
      await crearServicio(prueba.db, {
        empresaId: otraEmpresa.id,
        nombre: 'Servicio Tercero',
      });

      // B puede crear un servicio activo con el mismo nombre que A.
      await http()
        .post('/api/v1/servicios')
        .set('Cookie', sesionB.cookie)
        .send({ nombre: 'Servicio Exclusivo', activo: true })
        .expect(201);

      // El listado de B no contiene el servicio de A ni de otraEmpresa.
      const resListaB = await http()
        .get('/api/v1/servicios')
        .set('Cookie', sesionB.cookie)
        .expect(200);
      const idsB = paginaServiciosSchema.parse(resListaB.body).datos.map((s) => s.id);
      expect(idsB).not.toContain(servicioA.id);

      // B recibe 404 NO_ENCONTRADO al intentar leer, editar o eliminar el servicio de A.
      const resGet = await http()
        .get(`/api/v1/servicios/${servicioA.id}`)
        .set('Cookie', sesionB.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resGet.body).codigo).toBe('NO_ENCONTRADO');

      const resPatch = await http()
        .patch(`/api/v1/servicios/${servicioA.id}`)
        .set('Cookie', sesionB.cookie)
        .send({ nombre: 'Secuestrado' })
        .expect(404);
      expect(errorApiSchema.parse(resPatch.body).codigo).toBe('NO_ENCONTRADO');

      const resDelete = await http()
        .delete(`/api/v1/servicios/${servicioA.id}`)
        .set('Cookie', sesionB.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resDelete.body).codigo).toBe('NO_ENCONTRADO');
    });
  });
});
