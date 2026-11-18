import { empresaSchema, errorApiSchema } from '@portfolio/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import { crearEmpresa, crearSesionDePrueba } from './fabricas.js';

describe('empresa y políticas de reserva (integración)', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });

  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  const http = () => request(prueba.app.getHttpServer());

  describe('GET /api/v1/empresa', () => {
    it('rechaza con 401 NO_AUTENTICADO cuando no hay sesión activa', async () => {
      const res = await http().get('/api/v1/empresa').expect(401);
      expect(errorApiSchema.parse(res.body).codigo).toBe('NO_AUTENTICADO');
    });

    it('devuelve la empresa de la sesión activa y mantiene aislamiento frente a otras empresas', async () => {
      const otraEmpresa = await crearEmpresa(prueba.db, {
        nombre: 'Empresa Ajena',
        slug: 'empresa-ajena',
      });
      const sesion = await crearSesionDePrueba(prueba, { rol: 'recepcion' });

      const res = await http().get('/api/v1/empresa').set('Cookie', sesion.cookie).expect(200);
      const cuerpo = empresaSchema.parse(res.body);

      expect(cuerpo.id).toBe(sesion.empresa.id);
      expect(cuerpo.nombre).toBe(sesion.empresa.nombre);
      expect(cuerpo.slug).toBe(sesion.empresa.slug);
      expect(cuerpo.id).not.toBe(otraEmpresa.id);
    });

    it('permite consultar la empresa a cualquier rol autenticado', async () => {
      for (const rol of ['dueno', 'admin', 'recepcion', 'profesional'] as const) {
        const sesion = await crearSesionDePrueba(prueba, { rol });
        const res = await http().get('/api/v1/empresa').set('Cookie', sesion.cookie).expect(200);
        expect(empresaSchema.parse(res.body).id).toBe(sesion.empresa.id);
      }
    });
  });

  describe('PATCH /api/v1/empresa', () => {
    it('permite a dueño y admin actualizar perfil y políticas de reserva', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const resDueno = await http()
        .patch('/api/v1/empresa')
        .set('Cookie', sesionDueno.cookie)
        .send({
          nombre: 'Centro Kine Sur',
          slug: 'centro-kine-sur',
          rut: '76.123.456-7',
          email: 'CONTACTO@KINESUR.CL',
          telefono: '+56 9 1234 5678',
          direccion: 'Av. Providencia 1234',
          zonaHoraria: 'America/Argentina/Buenos_Aires',
          moneda: 'USD',
          anticipacionMinimaMinutos: 30,
          anticipacionMaximaDias: 90,
          cancelacionMinimaMinutos: 180,
          intervaloGrillaMinutos: 30,
          confirmacionAutomatica: false,
          recordatorioHorasAntes: 12,
        })
        .expect(200);

      const actualizada = empresaSchema.parse(resDueno.body);
      expect(actualizada).toMatchObject({
        id: sesionDueno.empresa.id,
        nombre: 'Centro Kine Sur',
        slug: 'centro-kine-sur',
        rut: '76.123.456-7',
        email: 'contacto@kinesur.cl',
        telefono: '+56 9 1234 5678',
        direccion: 'Av. Providencia 1234',
        zonaHoraria: 'America/Argentina/Buenos_Aires',
        moneda: 'USD',
        anticipacionMinimaMinutos: 30,
        anticipacionMaximaDias: 90,
        cancelacionMinimaMinutos: 180,
        intervaloGrillaMinutos: 30,
        confirmacionAutomatica: false,
        recordatorioHorasAntes: 12,
      });

      // También permite limpiar campos opcionales con null y actualizar siendo admin.
      const sesionAdmin = await crearSesionDePrueba(prueba, { rol: 'admin' });
      const resAdmin = await http()
        .patch('/api/v1/empresa')
        .set('Cookie', sesionAdmin.cookie)
        .send({
          nombre: 'Salón Norte',
          rut: null,
          email: null,
          telefono: null,
          direccion: null,
        })
        .expect(200);

      expect(empresaSchema.parse(resAdmin.body)).toMatchObject({
        nombre: 'Salón Norte',
        rut: null,
        email: null,
        telefono: null,
        direccion: null,
      });
    });

    it('rechaza con 403 SIN_PERMISO a recepción y profesional', async () => {
      for (const rol of ['recepcion', 'profesional'] as const) {
        const sesion = await crearSesionDePrueba(prueba, { rol });
        const res = await http()
          .patch('/api/v1/empresa')
          .set('Cookie', sesion.cookie)
          .send({ nombre: 'Intento No Autorizado' })
          .expect(403);

        expect(errorApiSchema.parse(res.body).codigo).toBe('SIN_PERMISO');
      }
    });

    it.each([
      { caso: 'anticipación mínima negativa', cuerpo: { anticipacionMinimaMinutos: -1 } },
      { caso: 'anticipación máxima menor a 1 día', cuerpo: { anticipacionMaximaDias: 0 } },
      { caso: 'cancelación mínima negativa', cuerpo: { cancelacionMinimaMinutos: -1 } },
      { caso: 'intervalo de grilla menor a 5', cuerpo: { intervaloGrillaMinutos: 4 } },
      { caso: 'intervalo de grilla mayor a 120', cuerpo: { intervaloGrillaMinutos: 121 } },
      { caso: 'recordatorio negativo', cuerpo: { recordatorioHorasAntes: -1 } },
      { caso: 'zona horaria IANA inválida', cuerpo: { zonaHoraria: 'America/NoExiste' } },
      { caso: 'cuerpo vacío', cuerpo: {} },
    ])('rechaza con 400 VALIDACION cuando envía $caso', async ({ cuerpo }) => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const res = await http()
        .patch('/api/v1/empresa')
        .set('Cookie', sesion.cookie)
        .send(cuerpo)
        .expect(400);

      expect(errorApiSchema.parse(res.body).codigo).toBe('VALIDACION');
    });

    it('rechaza con 409 CONFLICTO si el slug pertenece a otra empresa', async () => {
      const otraEmpresa = await crearEmpresa(prueba.db, { slug: 'salon-ocupado' });
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const res = await http()
        .patch('/api/v1/empresa')
        .set('Cookie', sesion.cookie)
        .send({ slug: otraEmpresa.slug })
        .expect(409);

      expect(errorApiSchema.parse(res.body).codigo).toBe('CONFLICTO');
    });

    it.each(['panel', 'ingresar'])(
      'rechaza con 400 VALIDACION el slug reservado "%s"',
      async (slugReservado) => {
        const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

        const res = await http()
          .patch('/api/v1/empresa')
          .set('Cookie', sesion.cookie)
          .send({ slug: slugReservado })
          .expect(400);

        expect(errorApiSchema.parse(res.body).codigo).toBe('VALIDACION');
      },
    );

    it('permite reenviar el mismo slug que ya tiene la empresa', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const res = await http()
        .patch('/api/v1/empresa')
        .set('Cookie', sesion.cookie)
        .send({
          slug: sesion.empresa.slug,
          nombre: 'Nombre Actualizado',
        })
        .expect(200);

      expect(empresaSchema.parse(res.body)).toMatchObject({
        slug: sesion.empresa.slug,
        nombre: 'Nombre Actualizado',
      });
    });
  });
});
