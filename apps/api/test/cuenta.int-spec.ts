import { randomBytes } from 'node:crypto';
import { errorApiSchema } from '@portfolio/contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COOKIE_SESION } from '../src/app.setup.js';
import { PasswordService } from '../src/auth/password.service.js';
import { hashTokenSesion } from '../src/auth/session.service.js';
import { hashTokenVerificacion } from '../src/cuenta/cuenta.service.js';
import { sesiones, tokensVerificacion, usuarios } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import { crearEmpresa, crearMiembro, crearSesionDePrueba, crearUsuario } from './fabricas.js';

let contadorIp = 1;
function siguienteIp(): string {
  const octeto4 = (contadorIp % 250) + 1;
  const octeto3 = Math.floor(contadorIp / 250) % 250;
  contadorIp++;
  return `10.30.${octeto3}.${octeto4}`;
}

function extraerTokenDeCorreo(texto: string, ruta: 'verificar' | 'restablecer'): string {
  const regex = new RegExp(`/${ruta}\\?token=([^\\s"'<]+)`);
  const coincidencia = texto.match(regex);
  if (!coincidencia?.[1]) {
    throw new Error(`No se encontró enlace de ${ruta} en el correo`);
  }
  return decodeURIComponent(coincidencia[1]);
}

describe('verificación de correo y recuperación de contraseña (integración)', () => {
  let prueba: AppDePrueba;
  let passwordService: PasswordService;

  beforeAll(async () => {
    prueba = await crearAppDePrueba();
    passwordService = new PasswordService();
  });

  afterAll(() => prueba.cerrar());

  beforeEach(async () => {
    await limpiarBaseDeDatos(prueba.db);
    prueba.mailer.enviados.length = 0;
  });

  const http = () => request(prueba.app.getHttpServer());

  describe('verificación de correo', () => {
    it('envía correo de verificación al registrarse y guarda solo el hash SHA-256 del token', async () => {
      const ip = siguienteIp();
      await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', ip)
        .send({
          nombreEmpresa: 'Centro Alfa',
          slug: 'centro-alfa',
          nombre: 'Lucía Pérez',
          email: 'lucia@example.com',
          password: 'clave-super-segura-123',
        })
        .expect(201);

      expect(prueba.mailer.enviados).toHaveLength(1);
      const correo = prueba.mailer.enviados[0];
      expect(correo?.para).toBe('lucia@example.com');
      const token = extraerTokenDeCorreo(correo?.texto ?? '', 'verificar');

      const filasTokens = await prueba.db.select().from(tokensVerificacion);
      expect(filasTokens).toHaveLength(1);
      expect(filasTokens[0]?.tipo).toBe('verificar_correo');
      expect(filasTokens[0]?.tokenHash).not.toBe(token);
      expect(filasTokens[0]?.tokenHash).toBe(hashTokenVerificacion(token));
      expect(filasTokens[0]?.usadoEn).toBeNull();
    });

    it('confirma el correo con token válido, impide reutilización y rechaza expirados o inexistentes', async () => {
      const ip = siguienteIp();
      const { usuario } = await crearSesionDePrueba(prueba);

      const tokenValido = randomBytes(32).toString('base64url');
      await prueba.db.insert(tokensVerificacion).values({
        usuarioId: usuario.id,
        tipo: 'verificar_correo',
        tokenHash: hashTokenVerificacion(tokenValido),
        expiraEn: new Date(Date.now() + 60 * 60 * 1000),
      });

      await http()
        .post('/api/v1/publico/verificar-correo')
        .set('X-Forwarded-For', ip)
        .send({ token: tokenValido })
        .expect(204);

      const [usuarioActualizado] = await prueba.db
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, usuario.id));
      expect(usuarioActualizado?.emailVerificadoEn).not.toBeNull();

      // Segundo uso del mismo token debe fallar
      const segundoUso = await http()
        .post('/api/v1/publico/verificar-correo')
        .set('X-Forwarded-For', ip)
        .send({ token: tokenValido })
        .expect(409);
      expect(errorApiSchema.parse(segundoUso.body).codigo).toBe('CONFLICTO');

      // Token expirado
      const tokenExpirado = randomBytes(32).toString('base64url');
      await prueba.db.insert(tokensVerificacion).values({
        usuarioId: usuario.id,
        tipo: 'verificar_correo',
        tokenHash: hashTokenVerificacion(tokenExpirado),
        expiraEn: new Date(Date.now() - 1000),
      });

      const respExpirado = await http()
        .post('/api/v1/publico/verificar-correo')
        .set('X-Forwarded-For', ip)
        .send({ token: tokenExpirado })
        .expect(409);
      expect(errorApiSchema.parse(respExpirado.body).codigo).toBe('CONFLICTO');

      // Token inexistente
      const respInexistente = await http()
        .post('/api/v1/publico/verificar-correo')
        .set('X-Forwarded-For', ip)
        .send({ token: 'token-inexistente-xyz' })
        .expect(409);
      expect(errorApiSchema.parse(respInexistente.body).codigo).toBe('CONFLICTO');
    });

    it('reenvía el correo invalidando el token anterior y es idempotente si ya está verificado', async () => {
      const ip = siguienteIp();
      const { cookie, usuario } = await crearSesionDePrueba(prueba);

      await http()
        .post('/api/v1/auth/verificar-correo/enviar')
        .set('X-Forwarded-For', ip)
        .set('Cookie', cookie)
        .expect(204);

      expect(prueba.mailer.enviados).toHaveLength(1);
      const primerToken = extraerTokenDeCorreo(prueba.mailer.enviados[0]?.texto ?? '', 'verificar');

      // Solicitar un segundo envío invalida el primero
      await http()
        .post('/api/v1/auth/verificar-correo/enviar')
        .set('X-Forwarded-For', ip)
        .set('Cookie', cookie)
        .expect(204);

      expect(prueba.mailer.enviados).toHaveLength(2);
      const segundoToken = extraerTokenDeCorreo(
        prueba.mailer.enviados[1]?.texto ?? '',
        'verificar',
      );
      expect(segundoToken).not.toBe(primerToken);

      await http()
        .post('/api/v1/publico/verificar-correo')
        .set('X-Forwarded-For', ip)
        .send({ token: primerToken })
        .expect(409);

      await http()
        .post('/api/v1/publico/verificar-correo')
        .set('X-Forwarded-For', ip)
        .send({ token: segundoToken })
        .expect(204);

      // Con el correo ya verificado, no vuelve a enviar correo
      await http()
        .post('/api/v1/auth/verificar-correo/enviar')
        .set('X-Forwarded-For', ip)
        .set('Cookie', cookie)
        .expect(204);

      expect(prueba.mailer.enviados).toHaveLength(2);

      // Sin sesión responde 401
      await http().post('/api/v1/auth/verificar-correo/enviar').expect(401);

      const [verificado] = await prueba.db
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, usuario.id));
      expect(verificado?.emailVerificadoEn).not.toBeNull();
    });
  });

  describe('recuperación y restablecimiento de contraseña', () => {
    it('responde 204 para correo existente e inexistente sin enviar correo en el segundo caso', async () => {
      const ip = siguienteIp();
      const usuario = await crearUsuario(prueba.db, { email: 'activo@example.com' });
      await crearUsuario(prueba.db, { email: 'inactivo@example.com', activo: false });

      await http()
        .post('/api/v1/publico/recuperar')
        .set('X-Forwarded-For', ip)
        .send({ email: 'no-existe@example.com' })
        .expect(204);

      await http()
        .post('/api/v1/publico/recuperar')
        .set('X-Forwarded-For', ip)
        .send({ email: 'inactivo@example.com' })
        .expect(204);

      expect(prueba.mailer.enviados).toHaveLength(0);

      await http()
        .post('/api/v1/publico/recuperar')
        .set('X-Forwarded-For', ip)
        .send({ email: 'ACTIVO@example.com' })
        .expect(204);

      expect(prueba.mailer.enviados).toHaveLength(1);
      const token = extraerTokenDeCorreo(prueba.mailer.enviados[0]?.texto ?? '', 'restablecer');

      const [filaToken] = await prueba.db
        .select()
        .from(tokensVerificacion)
        .where(eq(tokensVerificacion.usuarioId, usuario.id));
      expect(filaToken?.tipo).toBe('recuperar_contrasena');
      expect(filaToken?.tokenHash).not.toBe(token);
      expect(filaToken?.tokenHash).toBe(hashTokenVerificacion(token));
    });

    it('restablece la contraseña, permite ingresar con la nueva, revoca sesiones y rechaza tokens inválidos', async () => {
      const ip = siguienteIp();
      const empresa = await crearEmpresa(prueba.db);
      const passwordAnterior = 'clave-anterior-123';
      const passwordNueva = 'clave-nueva-segura-456';
      const usuario = await crearUsuario(prueba.db, {
        email: 'recupera@example.com',
        passwordHash: await passwordService.hash(passwordAnterior),
      });
      await crearMiembro(prueba.db, { empresaId: empresa.id, usuarioId: usuario.id, rol: 'dueno' });

      // Dos sesiones activas previas
      const tokenSesion1 = randomBytes(32).toString('base64url');
      const tokenSesion2 = randomBytes(32).toString('base64url');
      await prueba.db.insert(sesiones).values([
        {
          usuarioId: usuario.id,
          empresaId: empresa.id,
          tokenHash: hashTokenSesion(tokenSesion1),
          expiraEn: new Date(Date.now() + 3600_000),
        },
        {
          usuarioId: usuario.id,
          empresaId: empresa.id,
          tokenHash: hashTokenSesion(tokenSesion2),
          expiraEn: new Date(Date.now() + 3600_000),
        },
      ]);

      await http()
        .post('/api/v1/publico/recuperar')
        .set('X-Forwarded-For', ip)
        .send({ email: usuario.email })
        .expect(204);

      const token = extraerTokenDeCorreo(prueba.mailer.enviados[0]?.texto ?? '', 'restablecer');

      await http()
        .post('/api/v1/publico/restablecer')
        .set('X-Forwarded-For', ip)
        .send({ token, password: passwordNueva })
        .expect(204);

      // Todas las sesiones previas fueron revocadas
      await http()
        .get('/api/v1/auth/sesion')
        .set('Cookie', `${COOKIE_SESION}=${tokenSesion1}`)
        .expect(401);
      await http()
        .get('/api/v1/auth/sesion')
        .set('Cookie', `${COOKIE_SESION}=${tokenSesion2}`)
        .expect(401);

      // Token usado ya no sirve
      await http()
        .post('/api/v1/publico/restablecer')
        .set('X-Forwarded-For', ip)
        .send({ token, password: 'otra-clave-larga-789' })
        .expect(409);

      // Contraseña anterior falla y la nueva funciona
      await http()
        .post('/api/v1/auth/ingresar')
        .set('X-Forwarded-For', ip)
        .send({ email: usuario.email, password: passwordAnterior })
        .expect(401);

      await http()
        .post('/api/v1/auth/ingresar')
        .set('X-Forwarded-For', ip)
        .send({ email: usuario.email, password: passwordNueva })
        .expect(200);

      // Token expirado falla
      const tokenExpirado = randomBytes(32).toString('base64url');
      await prueba.db.insert(tokensVerificacion).values({
        usuarioId: usuario.id,
        tipo: 'recuperar_contrasena',
        tokenHash: hashTokenVerificacion(tokenExpirado),
        expiraEn: new Date(Date.now() - 1000),
      });

      await http()
        .post('/api/v1/publico/restablecer')
        .set('X-Forwarded-For', ip)
        .send({ token: tokenExpirado, password: 'otra-clave-larga-789' })
        .expect(409);
    });

    it('aplica límite de peticiones en /publico/recuperar y responde 429', async () => {
      const ip = siguienteIp();
      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/v1/publico/recuperar')
          .set('X-Forwarded-For', ip)
          .send({ email: 'limite@example.com' })
          .expect(204);
      }

      const bloqueada = await http()
        .post('/api/v1/publico/recuperar')
        .set('X-Forwarded-For', ip)
        .send({ email: 'limite@example.com' })
        .expect(429);

      expect(errorApiSchema.parse(bloqueada.body).codigo).toBe('DEMASIADAS_SOLICITUDES');
    });
  });

  describe('cambio de contraseña autenticado', () => {
    it('exige contraseña actual correcta, mantiene viva la sesión actual y revoca las demás', async () => {
      const ip = siguienteIp();
      const empresa = await crearEmpresa(prueba.db);
      const passwordActual = 'clave-actual-segura-123';
      const passwordNueva = 'clave-nueva-segura-999';
      const usuario = await crearUsuario(prueba.db, {
        email: 'cambio@example.com',
        passwordHash: await passwordService.hash(passwordActual),
      });
      await crearMiembro(prueba.db, { empresaId: empresa.id, usuarioId: usuario.id, rol: 'dueno' });

      const tokenActual = randomBytes(32).toString('base64url');
      const tokenOtra = randomBytes(32).toString('base64url');
      await prueba.db.insert(sesiones).values([
        {
          usuarioId: usuario.id,
          empresaId: empresa.id,
          tokenHash: hashTokenSesion(tokenActual),
          expiraEn: new Date(Date.now() + 3600_000),
        },
        {
          usuarioId: usuario.id,
          empresaId: empresa.id,
          tokenHash: hashTokenSesion(tokenOtra),
          expiraEn: new Date(Date.now() + 3600_000),
        },
      ]);

      const cookieActual = `${COOKIE_SESION}=${tokenActual}`;
      const cookieOtra = `${COOKIE_SESION}=${tokenOtra}`;

      // Sin sesión responde 401
      await http()
        .post('/api/v1/auth/cambiar-contrasena')
        .set('X-Forwarded-For', ip)
        .send({ passwordActual, passwordNueva })
        .expect(401);

      // Contraseña actual incorrecta responde 401
      const incorrecta = await http()
        .post('/api/v1/auth/cambiar-contrasena')
        .set('X-Forwarded-For', ip)
        .set('Cookie', cookieActual)
        .send({ passwordActual: 'equivocada-123', passwordNueva })
        .expect(401);
      expect(errorApiSchema.parse(incorrecta.body).codigo).toBe('NO_AUTENTICADO');

      // Contraseña actual correcta cambia el hash, mantiene cookieActual y revoca cookieOtra
      await http()
        .post('/api/v1/auth/cambiar-contrasena')
        .set('X-Forwarded-For', ip)
        .set('Cookie', cookieActual)
        .send({ passwordActual, passwordNueva })
        .expect(204);

      await http().get('/api/v1/auth/sesion').set('Cookie', cookieActual).expect(200);
      await http().get('/api/v1/auth/sesion').set('Cookie', cookieOtra).expect(401);

      const filasSesiones = await prueba.db
        .select()
        .from(sesiones)
        .where(and(eq(sesiones.usuarioId, usuario.id)));
      const activa = filasSesiones.find((s) => s.tokenHash === hashTokenSesion(tokenActual));
      const revocada = filasSesiones.find((s) => s.tokenHash === hashTokenSesion(tokenOtra));
      expect(activa?.revocadaEn).toBeNull();
      expect(revocada?.revocadaEn).not.toBeNull();

      // Puede ingresar con la contraseña nueva
      await http()
        .post('/api/v1/auth/ingresar')
        .set('X-Forwarded-For', ip)
        .send({ email: usuario.email, password: passwordNueva })
        .expect(200);
    });
  });
});
