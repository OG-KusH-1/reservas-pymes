import { randomBytes } from 'node:crypto';
import {
  detalleInvitacionPublicaSchema,
  empresaDeUsuarioSchema,
  errorApiSchema,
  invitacionSchema,
  miembroSchema,
  sesionSchema,
} from '@portfolio/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { COOKIE_SESION } from '../src/app.setup.js';
import { hashTokenSesion } from '../src/auth/session.service.js';
import { invitaciones, miembros, sesiones, usuarios } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import { crearEmpresa, crearMiembro, crearSesionDePrueba, crearUsuario } from './fabricas.js';

let contadorIp = 1;
function siguienteIp(): string {
  const octeto4 = (contadorIp % 250) + 1;
  const octeto3 = Math.floor(contadorIp / 250) % 250;
  contadorIp++;
  return `10.30.${octeto3}.${octeto4}`;
}

function extraerValorCookie(setCookie: string[] | string | undefined): string {
  const lista = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const encontrada = lista.find((c) => c.startsWith(`${COOKIE_SESION}=`));
  if (!encontrada) {
    throw new Error(`No se encontró la cookie ${COOKIE_SESION} en Set-Cookie`);
  }
  return encontrada.split(';')[0] ?? '';
}

function extraerTokenDeCorreo(texto: string): string {
  const coincidencia = /\/invitacion\?token=([A-Za-z0-9_-]+)/.exec(texto);
  if (!coincidencia?.[1]) {
    throw new Error('No se encontró el token de invitación en el correo enviado');
  }
  return coincidencia[1];
}

describe('miembros, invitaciones y cambio de empresa (integración)', () => {
  let prueba: AppDePrueba;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
  });

  afterAll(() => prueba.cerrar());
  beforeEach(() => {
    prueba.mailer.enviados.length = 0;
    return limpiarBaseDeDatos(prueba.db);
  });

  const http = () => request(prueba.app.getHttpServer());

  describe('gestión de miembros', () => {
    it('lista miembros solo de la empresa activa y permite lectura a cualquier rol autenticado', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const otroUsuario = await crearUsuario(prueba.db, { email: 'recep@example.com' });
      await crearMiembro(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        usuarioId: otroUsuario.id,
        rol: 'recepcion',
      });

      // Miembro de otra empresa no debe aparecer en el listado.
      await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const res = await http()
        .get('/api/v1/miembros')
        .set('Cookie', sesionDueno.cookie)
        .expect(200);

      const lista = z.array(miembroSchema).parse(res.body);
      expect(lista).toHaveLength(2);
      expect(lista.map((m) => m.email)).toEqual([sesionDueno.usuario.email, 'recep@example.com']);

      // Recepción también puede listar.
      const tokenRecep = randomBytes(32).toString('base64url');
      await prueba.db.insert(sesiones).values({
        usuarioId: otroUsuario.id,
        empresaId: sesionDueno.empresa.id,
        tokenHash: hashTokenSesion(tokenRecep),
        expiraEn: new Date(Date.now() + 86_400_000),
      });

      await http()
        .get('/api/v1/miembros')
        .set('Cookie', `${COOKIE_SESION}=${tokenRecep}`)
        .expect(200);
    });

    it('rechaza con 404 al intentar actualizar o eliminar un miembro de otra empresa', async () => {
      const sesionA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionB = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const [miembroB] = await prueba.db
        .select()
        .from(miembros)
        .where(eq(miembros.empresaId, sesionB.empresa.id));

      const resPatch = await http()
        .patch(`/api/v1/miembros/${miembroB!.id}`)
        .set('Cookie', sesionA.cookie)
        .send({ rol: 'admin' })
        .expect(404);
      expect(errorApiSchema.parse(resPatch.body).codigo).toBe('NO_ENCONTRADO');

      const resDelete = await http()
        .delete(`/api/v1/miembros/${miembroB!.id}`)
        .set('Cookie', sesionA.cookie)
        .expect(404);
      expect(errorApiSchema.parse(resDelete.body).codigo).toBe('NO_ENCONTRADO');
    });

    it('permite cambiar rol y al desactivar o eliminar revoca sesiones activas del miembro', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const prof = await crearUsuario(prueba.db, { email: 'prof@example.com' });
      const miembroProf = await crearMiembro(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        usuarioId: prof.id,
        rol: 'profesional',
      });

      const tokenProf = randomBytes(32).toString('base64url');
      await prueba.db.insert(sesiones).values({
        usuarioId: prof.id,
        empresaId: sesionDueno.empresa.id,
        tokenHash: hashTokenSesion(tokenProf),
        expiraEn: new Date(Date.now() + 86_400_000),
      });
      const cookieProf = `${COOKIE_SESION}=${tokenProf}`;

      // Cambia rol a admin.
      const resRol = await http()
        .patch(`/api/v1/miembros/${miembroProf.id}`)
        .set('Cookie', sesionDueno.cookie)
        .send({ rol: 'admin' })
        .expect(200);
      expect(miembroSchema.parse(resRol.body).rol).toBe('admin');

      // Desactiva: debe revocar su sesión activa.
      const resDesactivar = await http()
        .patch(`/api/v1/miembros/${miembroProf.id}`)
        .set('Cookie', sesionDueno.cookie)
        .send({ activo: false })
        .expect(200);
      expect(miembroSchema.parse(resDesactivar.body).activo).toBe(false);

      await http().get('/api/v1/auth/sesion').set('Cookie', cookieProf).expect(401);

      // Reactiva y abre nueva sesión para probar que DELETE también la revoca.
      await http()
        .patch(`/api/v1/miembros/${miembroProf.id}`)
        .set('Cookie', sesionDueno.cookie)
        .send({ activo: true })
        .expect(200);

      const tokenProf2 = randomBytes(32).toString('base64url');
      await prueba.db.insert(sesiones).values({
        usuarioId: prof.id,
        empresaId: sesionDueno.empresa.id,
        tokenHash: hashTokenSesion(tokenProf2),
        expiraEn: new Date(Date.now() + 86_400_000),
      });
      const cookieProf2 = `${COOKIE_SESION}=${tokenProf2}`;

      await http()
        .delete(`/api/v1/miembros/${miembroProf.id}`)
        .set('Cookie', sesionDueno.cookie)
        .expect(204);

      await http().get('/api/v1/auth/sesion').set('Cookie', cookieProf2).expect(401);
    });

    it('impide modificarse o eliminarse a sí mismo (409) y protege al último dueño activo (409)', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const [miembroDueno] = await prueba.db
        .select()
        .from(miembros)
        .where(eq(miembros.empresaId, sesionDueno.empresa.id));

      const resAutoPatch = await http()
        .patch(`/api/v1/miembros/${miembroDueno!.id}`)
        .set('Cookie', sesionDueno.cookie)
        .send({ rol: 'admin' })
        .expect(409);
      expect(errorApiSchema.parse(resAutoPatch.body).codigo).toBe('CONFLICTO');

      const resAutoDelete = await http()
        .delete(`/api/v1/miembros/${miembroDueno!.id}`)
        .set('Cookie', sesionDueno.cookie)
        .expect(409);
      expect(errorApiSchema.parse(resAutoDelete.body).codigo).toBe('CONFLICTO');

      // Agregamos un segundo dueño para intentar degradar/eliminar al primero:
      // desde el segundo dueño, si intentamos degradar al primero SÍ se puede porque queda el segundo;
      // luego, con un solo dueño activo, un admin no puede tocarlo y otro dueño no puede quedarse solo.
      const segundoDueno = await crearUsuario(prueba.db);
      const miembroSegundo = await crearMiembro(prueba.db, {
        empresaId: sesionDueno.empresa.id,
        usuarioId: segundoDueno.id,
        rol: 'dueno',
      });
      const tokenSegundo = randomBytes(32).toString('base64url');
      await prueba.db.insert(sesiones).values({
        usuarioId: segundoDueno.id,
        empresaId: sesionDueno.empresa.id,
        tokenHash: hashTokenSesion(tokenSegundo),
        expiraEn: new Date(Date.now() + 86_400_000),
      });

      // Segundo dueño degrada al primero (válido porque queda el segundo).
      await http()
        .patch(`/api/v1/miembros/${miembroDueno!.id}`)
        .set('Cookie', `${COOKIE_SESION}=${tokenSegundo}`)
        .send({ rol: 'admin' })
        .expect(200);

      // Ahora miembroSegundo es el único dueño activo; el admin (antes primer dueño) no puede tocar a un dueño (403).
      const resAdminSobreDueno = await http()
        .patch(`/api/v1/miembros/${miembroSegundo.id}`)
        .set('Cookie', sesionDueno.cookie)
        .send({ activo: false })
        .expect(403);
      expect(errorApiSchema.parse(resAdminSobreDueno.body).codigo).toBe('SIN_PERMISO');
    });

    it('impide a un admin otorgar o quitar el rol dueno y bloquea a recepcion/profesional (403)', async () => {
      const sesionAdmin = await crearSesionDePrueba(prueba, { rol: 'admin' });
      const otro = await crearUsuario(prueba.db);
      const miembroOtro = await crearMiembro(prueba.db, {
        empresaId: sesionAdmin.empresa.id,
        usuarioId: otro.id,
        rol: 'profesional',
      });

      const resOtorgarDueno = await http()
        .patch(`/api/v1/miembros/${miembroOtro.id}`)
        .set('Cookie', sesionAdmin.cookie)
        .send({ rol: 'dueno' })
        .expect(403);
      expect(errorApiSchema.parse(resOtorgarDueno.body).codigo).toBe('SIN_PERMISO');

      const sesionRecep = await crearSesionDePrueba(prueba, { rol: 'recepcion' });
      await http()
        .patch(`/api/v1/miembros/${miembroOtro.id}`)
        .set('Cookie', sesionRecep.cookie)
        .send({ activo: false })
        .expect(403);

      const sesionProf = await crearSesionDePrueba(prueba, { rol: 'profesional' });
      await http()
        .delete(`/api/v1/miembros/${miembroOtro.id}`)
        .set('Cookie', sesionProf.cookie)
        .expect(403);
    });
  });

  describe('invitaciones internas', () => {
    it('crea invitación, guarda solo hash en BD, envía correo y permite listar/revocar', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      const resCrear = await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .send({ email: '  Nueva.Persona@Example.com ', rol: 'recepcion' })
        .expect(201);

      const inv = invitacionSchema.parse(resCrear.body);
      expect(inv.email).toBe('nueva.persona@example.com');
      expect(inv.rol).toBe('recepcion');

      expect(prueba.mailer.enviados).toHaveLength(1);
      const correo = prueba.mailer.enviados[0]!;
      expect(correo.para).toBe('nueva.persona@example.com');
      const tokenClaro = extraerTokenDeCorreo(correo.texto);

      const [filaBd] = await prueba.db
        .select()
        .from(invitaciones)
        .where(eq(invitaciones.id, inv.id));
      expect(filaBd).toBeDefined();
      expect(filaBd!.tokenHash).not.toBe(tokenClaro);
      expect(filaBd!.tokenHash).toBe(hashTokenSesion(tokenClaro));

      const resLista = await http()
        .get('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .expect(200);
      expect(z.array(invitacionSchema).parse(resLista.body)).toHaveLength(1);

      // Revocar invitación.
      await http()
        .delete(`/api/v1/invitaciones/${inv.id}`)
        .set('Cookie', sesionDueno.cookie)
        .expect(204);

      const resListaDespues = await http()
        .get('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .expect(200);
      expect(z.array(invitacionSchema).parse(resListaDespues.body)).toHaveLength(0);
    });

    it('rechaza invitar a un miembro existente (409), restringe rol dueno a dueno (403) y aísla revocación (404)', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionAdmin = await crearSesionDePrueba(prueba, { rol: 'admin' });

      const resExistente = await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .send({ email: sesionDueno.usuario.email, rol: 'admin' })
        .expect(409);
      expect(errorApiSchema.parse(resExistente.body).codigo).toBe('CONFLICTO');

      const resAdminInvitaDueno = await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionAdmin.cookie)
        .send({ email: 'alguien@example.com', rol: 'dueno' })
        .expect(403);
      expect(errorApiSchema.parse(resAdminInvitaDueno.body).codigo).toBe('SIN_PERMISO');

      // Invitación en empresa del dueño no puede ser revocada por otra empresa.
      const resInv = await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .send({ email: 'invitado@example.com', rol: 'profesional' })
        .expect(201);
      const inv = invitacionSchema.parse(resInv.body);

      await http()
        .delete(`/api/v1/invitaciones/${inv.id}`)
        .set('Cookie', sesionAdmin.cookie)
        .expect(404);
    });
  });

  describe('aceptación pública de invitaciones', () => {
    it('consulta detalle, acepta con cuenta nueva y rechaza segundo uso (409)', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .send({ email: 'nuevo@example.com', rol: 'profesional' })
        .expect(201);

      const token = extraerTokenDeCorreo(prueba.mailer.enviados[0]!.texto);

      // Token inexistente -> 404.
      const resNoExiste = await http()
        .get('/api/v1/publico/invitaciones/token-inexistente')
        .set('X-Forwarded-For', siguienteIp())
        .expect(404);
      expect(errorApiSchema.parse(resNoExiste.body).codigo).toBe('NO_ENCONTRADO');

      // Detalle válido.
      const resDetalle = await http()
        .get(`/api/v1/publico/invitaciones/${token}`)
        .set('X-Forwarded-For', siguienteIp())
        .expect(200);
      const detalle = detalleInvitacionPublicaSchema.parse(resDetalle.body);
      expect(detalle.email).toBe('nuevo@example.com');
      expect(detalle.rol).toBe('profesional');
      expect(detalle.usuarioExiste).toBe(false);

      // Si faltan nombre o password para cuenta nueva -> 400 VALIDACION.
      const resSinDatos = await http()
        .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
        .set('X-Forwarded-For', siguienteIp())
        .send({})
        .expect(400);
      expect(errorApiSchema.parse(resSinDatos.body).codigo).toBe('VALIDACION');

      // Acepta creando usuario + miembro + sesión.
      const resAceptar = await http()
        .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
        .set('X-Forwarded-For', siguienteIp())
        .send({ nombre: 'Nuevo Profesional', password: 'clave-super-segura-123' })
        .expect(200);

      const sesion = sesionSchema.parse(resAceptar.body);
      expect(sesion.usuario.email).toBe('nuevo@example.com');
      expect(sesion.usuario.emailVerificado).toBe(true);
      expect(sesion.empresa.id).toBe(sesionDueno.empresa.id);
      expect(sesion.rol).toBe('profesional');

      const cookieNueva = extraerValorCookie(resAceptar.headers['set-cookie']);
      await http().get('/api/v1/auth/sesion').set('Cookie', cookieNueva).expect(200);

      // Segundo uso del mismo token falla con 409.
      const resSegundoUso = await http()
        .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
        .set('X-Forwarded-For', siguienteIp())
        .send({ nombre: 'Otro', password: 'clave-super-segura-123' })
        .expect(409);
      expect(errorApiSchema.parse(resSegundoUso.body).codigo).toBe('CONFLICTO');
    });

    it('acepta con cuenta existente exigiendo sesión del mismo correo y rechaza tokens expirados', async () => {
      const sesionEmpresaA = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionUsuarioExistente = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionOtroUsuario = await crearSesionDePrueba(prueba, { rol: 'dueno' });

      await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionEmpresaA.cookie)
        .send({ email: sesionUsuarioExistente.usuario.email, rol: 'admin' })
        .expect(201);

      const token = extraerTokenDeCorreo(prueba.mailer.enviados[0]!.texto);

      // Detalle indica que el usuario ya existe.
      const resDetalle = await http()
        .get(`/api/v1/publico/invitaciones/${token}`)
        .set('X-Forwarded-For', siguienteIp())
        .expect(200);
      expect(detalleInvitacionPublicaSchema.parse(resDetalle.body).usuarioExiste).toBe(true);

      // Sin cookie -> 401.
      await http()
        .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
        .set('X-Forwarded-For', siguienteIp())
        .send({})
        .expect(401);

      // Con sesión de otro correo -> 403.
      await http()
        .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
        .set('X-Forwarded-For', siguienteIp())
        .set('Cookie', sesionOtroUsuario.cookie)
        .send({})
        .expect(403);

      // Con sesión del mismo correo -> 200 y queda en la empresa invitante.
      const resOk = await http()
        .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
        .set('X-Forwarded-For', siguienteIp())
        .set('Cookie', sesionUsuarioExistente.cookie)
        .send({})
        .expect(200);
      const sesion = sesionSchema.parse(resOk.body);
      expect(sesion.empresa.id).toBe(sesionEmpresaA.empresa.id);
      expect(sesion.rol).toBe('admin');

      // Token expirado -> 409.
      const tokenExpirado = randomBytes(32).toString('base64url');
      await prueba.db.insert(invitaciones).values({
        empresaId: sesionEmpresaA.empresa.id,
        email: 'expirado@example.com',
        rol: 'recepcion',
        tokenHash: hashTokenSesion(tokenExpirado),
        expiraEn: new Date(Date.now() - 60_000),
      });

      const resExpirado = await http()
        .get(`/api/v1/publico/invitaciones/${tokenExpirado}`)
        .set('X-Forwarded-For', siguienteIp())
        .expect(409);
      expect(errorApiSchema.parse(resExpirado.body).codigo).toBe('CONFLICTO');
    });

    it('garantiza un solo uso ante peticiones concurrentes de aceptación', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      await http()
        .post('/api/v1/invitaciones')
        .set('Cookie', sesionDueno.cookie)
        .send({ email: 'concurrente@example.com', rol: 'recepcion' })
        .expect(201);

      const token = extraerTokenDeCorreo(prueba.mailer.enviados[0]!.texto);
      const cuerpo = { nombre: 'Usuario Concurrente', password: 'clave-super-segura-123' };

      const [res1, res2] = await Promise.all([
        http()
          .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
          .set('X-Forwarded-For', siguienteIp())
          .send(cuerpo),
        http()
          .post(`/api/v1/publico/invitaciones/${token}/aceptar`)
          .set('X-Forwarded-For', siguienteIp())
          .send(cuerpo),
      ]);

      const estados = [res1.status, res2.status].sort((a, b) => a - b);
      expect(estados).toEqual([200, 409]);

      const usuariosCreados = await prueba.db
        .select()
        .from(usuarios)
        .where(eq(usuarios.email, 'concurrente@example.com'));
      expect(usuariosCreados).toHaveLength(1);
    });
  });

  describe('empresas del usuario y cambio de empresa activa', () => {
    it('lista empresas activas del usuario, cambia la empresa activa y rechaza empresas ajenas', async () => {
      const sesion = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const empresaB = await crearEmpresa(prueba.db, { nombre: 'Empresa B' });
      const empresaAjena = await crearEmpresa(prueba.db, { nombre: 'Empresa Ajena' });

      await crearMiembro(prueba.db, {
        empresaId: empresaB.id,
        usuarioId: sesion.usuario.id,
        rol: 'profesional',
      });

      const resLista = await http()
        .get('/api/v1/auth/empresas')
        .set('Cookie', sesion.cookie)
        .expect(200);

      const lista = z.array(empresaDeUsuarioSchema).parse(resLista.body);
      expect(lista).toHaveLength(2);
      expect(lista.find((e) => e.id === sesion.empresa.id)?.activa).toBe(true);
      expect(lista.find((e) => e.id === empresaB.id)?.activa).toBe(false);

      // Cambiar a empresa B.
      const resCambio = await http()
        .post('/api/v1/auth/empresa-activa')
        .set('Cookie', sesion.cookie)
        .send({ empresaId: empresaB.id })
        .expect(200);

      const nuevaSesion = sesionSchema.parse(resCambio.body);
      expect(nuevaSesion.empresa.id).toBe(empresaB.id);
      expect(nuevaSesion.rol).toBe('profesional');

      // Las peticiones siguientes ven la nueva empresa activa.
      const resSesionActual = await http()
        .get('/api/v1/auth/sesion')
        .set('Cookie', sesion.cookie)
        .expect(200);
      expect(sesionSchema.parse(resSesionActual.body).empresa.id).toBe(empresaB.id);

      // Rechaza cambiar a una empresa a la que no pertenece.
      const resAjena = await http()
        .post('/api/v1/auth/empresa-activa')
        .set('Cookie', sesion.cookie)
        .send({ empresaId: empresaAjena.id })
        .expect(404);
      expect(errorApiSchema.parse(resAjena.body).codigo).toBe('NO_ENCONTRADO');
    });
  });
});
