import { Controller, Get, Post } from '@nestjs/common';
import { errorApiSchema, sesionSchema } from '@portfolio/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { COOKIE_SESION } from '../src/app.setup.js';
import {
  EmpresaId,
  Roles,
  SesionActual,
  type ContextoSesion,
} from '../src/auth/auth.decorators.js';
import { PasswordService } from '../src/auth/password.service.js';
import { hashTokenSesion } from '../src/auth/session.service.js';
import { empresas, miembros, sesiones, usuarios } from '../src/db/schema.js';
import { crearAppDePrueba, limpiarBaseDeDatos, type AppDePrueba } from './app.js';
import { crearEmpresa, crearMiembro, crearSesionDePrueba, crearUsuario } from './fabricas.js';

@Controller('prueba-auth')
class PruebaAuthController {
  @Get('protegida')
  protegida(@SesionActual() sesion: ContextoSesion, @EmpresaId() empresaId: string) {
    return { empresaId, usuarioId: sesion.usuario.id, rol: sesion.rol };
  }

  @Get('solo-admin')
  @Roles('admin')
  soloAdmin(@EmpresaId() empresaId: string) {
    return { empresaId };
  }

  @Post('mutacion')
  mutacion(@EmpresaId() empresaId: string) {
    return { ok: true, empresaId };
  }
}

let contadorIp = 1;
function siguienteIp(): string {
  const octeto4 = (contadorIp % 250) + 1;
  const octeto3 = Math.floor(contadorIp / 250) % 250;
  contadorIp++;
  return `10.20.${octeto3}.${octeto4}`;
}

function extraerValorCookie(setCookie: string[] | string | undefined): string {
  const lista = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const encontrada = lista.find((c) => c.startsWith(`${COOKIE_SESION}=`));
  if (!encontrada) {
    throw new Error(`No se encontró la cookie ${COOKIE_SESION} en Set-Cookie`);
  }
  return encontrada.split(';')[0] ?? '';
}

describe('autenticación y autorización (integración)', () => {
  let prueba: AppDePrueba;
  let passwordService: PasswordService;

  beforeAll(async () => {
    prueba = await crearAppDePrueba({ controladores: [PruebaAuthController] });
    passwordService = new PasswordService();
  });

  afterAll(() => prueba.cerrar());
  beforeEach(() => limpiarBaseDeDatos(prueba.db));

  const http = () => request(prueba.app.getHttpServer());

  const datosRegistroValidos = (sufijo = 'uno') => ({
    nombreEmpresa: `Estudio ${sufijo}`,
    slug: `estudio-${sufijo}`,
    nombre: 'Camila Rojas',
    email: `camila-${sufijo}@example.com`,
    password: 'clave-super-segura-123',
  });

  describe('registro', () => {
    it('crea empresa, usuario y membresía dueno, deja cookie httpOnly y responde con Sesion', async () => {
      const datos = datosRegistroValidos('alfa');
      const respuesta = await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', siguienteIp())
        .send(datos)
        .expect(201);

      const sesion = sesionSchema.parse(respuesta.body);
      expect(sesion.empresa.slug).toBe(datos.slug);
      expect(sesion.usuario.email).toBe(datos.email);
      expect(sesion.rol).toBe('dueno');
      expect(JSON.stringify(respuesta.body)).not.toContain('passwordHash');
      expect(JSON.stringify(respuesta.body)).not.toContain('tokenHash');

      const setCookie = respuesta.headers['set-cookie'] as string[] | undefined;
      expect(setCookie).toBeDefined();
      const cookieCruda = setCookie?.[0] ?? '';
      expect(cookieCruda).toContain(`${COOKIE_SESION}=`);
      expect(cookieCruda).toContain('HttpOnly');
      expect(cookieCruda).toContain('SameSite=Lax');
      expect(cookieCruda).toContain('Path=/');
      expect(cookieCruda).not.toContain('Secure');

      const [filaUsuario] = await prueba.db
        .select()
        .from(usuarios)
        .where(eq(usuarios.email, datos.email));
      expect(filaUsuario).toBeDefined();
      expect(filaUsuario?.passwordHash).not.toBe(datos.password);
      expect(filaUsuario?.passwordHash.startsWith('$argon2id$')).toBe(true);

      const filasEmpresas = await prueba.db.select().from(empresas);
      const filasMiembros = await prueba.db.select().from(miembros);
      const filasSesiones = await prueba.db.select().from(sesiones);
      expect(filasEmpresas).toHaveLength(1);
      expect(filasMiembros).toHaveLength(1);
      expect(filasMiembros[0]?.rol).toBe('dueno');
      expect(filasSesiones).toHaveLength(1);

      const cookieHeader = extraerValorCookie(setCookie);
      const tokenClaro = cookieHeader.slice(`${COOKIE_SESION}=`.length);
      expect(filasSesiones[0]?.tokenHash).not.toBe(tokenClaro);
      expect(filasSesiones[0]?.tokenHash).toBe(hashTokenSesion(tokenClaro));

      const sesionActual = await http()
        .get('/api/v1/auth/sesion')
        .set('Cookie', cookieHeader)
        .expect(200);
      expect(sesionSchema.parse(sesionActual.body)).toEqual(sesion);
    });

    it('rechaza correo duplicado y slug duplicado con 409 y mensajes distintos, sin filas a medias', async () => {
      const primero = datosRegistroValidos('dup');
      await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', siguienteIp())
        .send(primero)
        .expect(201);

      const resCorreoDup = await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', siguienteIp())
        .send({ ...datosRegistroValidos('otro-slug'), email: primero.email })
        .expect(409);

      const resSlugDup = await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', siguienteIp())
        .send({ ...datosRegistroValidos('otro-correo'), slug: primero.slug })
        .expect(409);

      const errCorreo = errorApiSchema.parse(resCorreoDup.body);
      const errSlug = errorApiSchema.parse(resSlugDup.body);
      expect(errCorreo.codigo).toBe('CONFLICTO');
      expect(errSlug.codigo).toBe('CONFLICTO');
      expect(errCorreo.mensaje).not.toBe(errSlug.mensaje);

      expect(await prueba.db.select().from(empresas)).toHaveLength(1);
      expect(await prueba.db.select().from(usuarios)).toHaveLength(1);
      expect(await prueba.db.select().from(miembros)).toHaveLength(1);
    });

    it('responde 400 con detalles por campo ante datos inválidos', async () => {
      const respuesta = await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', siguienteIp())
        .send({
          nombreEmpresa: 'A',
          slug: 'Slug Invalido!',
          nombre: 'B',
          email: 'no-es-correo',
          password: 'corta',
        })
        .expect(400);

      const error = errorApiSchema.parse(respuesta.body);
      expect(error.codigo).toBe('VALIDACION');
      expect(error.detalles?.map((d) => d.campo).sort()).toEqual([
        'email',
        'nombre',
        'nombreEmpresa',
        'password',
        'slug',
      ]);
    });
  });

  describe('ingreso y salida', () => {
    it('inicia sesión con credenciales válidas y entrega la empresa de membresía más antigua', async () => {
      const clave = 'mi-clave-secreta-2026';
      const passwordHash = await passwordService.hash(clave);
      const usuario = await crearUsuario(prueba.db, {
        email: 'multi@example.com',
        passwordHash,
      });
      const empresaAntigua = await crearEmpresa(prueba.db, { slug: 'antigua' });
      const empresaNueva = await crearEmpresa(prueba.db, { slug: 'nueva' });

      await crearMiembro(prueba.db, {
        empresaId: empresaAntigua.id,
        usuarioId: usuario.id,
        rol: 'admin',
        creadoEn: new Date('2026-01-01T00:00:00Z'),
      });
      await crearMiembro(prueba.db, {
        empresaId: empresaNueva.id,
        usuarioId: usuario.id,
        rol: 'dueno',
        creadoEn: new Date('2026-06-01T00:00:00Z'),
      });

      const respuesta = await http()
        .post('/api/v1/auth/ingresar')
        .set('X-Forwarded-For', siguienteIp())
        .send({ email: 'multi@example.com', password: clave })
        .expect(200);

      const sesion = sesionSchema.parse(respuesta.body);
      expect(sesion.empresa.id).toBe(empresaAntigua.id);
      expect(sesion.rol).toBe('admin');
      expect(extraerValorCookie(respuesta.headers['set-cookie'])).toContain(`${COOKIE_SESION}=`);
    });

    it('responde con el mismo 401 ante contraseña incorrecta y correo inexistente', async () => {
      const passwordHash = await passwordService.hash('clave-correcta-123');
      await crearUsuario(prueba.db, { email: 'existe@example.com', passwordHash });

      const resPassMala = await http()
        .post('/api/v1/auth/ingresar')
        .set('X-Forwarded-For', siguienteIp())
        .send({ email: 'existe@example.com', password: 'clave-equivocada' })
        .expect(401);

      const resNoExiste = await http()
        .post('/api/v1/auth/ingresar')
        .set('X-Forwarded-For', siguienteIp())
        .send({ email: 'no-existe@example.com', password: 'clave-equivocada' })
        .expect(401);

      const err1 = errorApiSchema.parse(resPassMala.body);
      const err2 = errorApiSchema.parse(resNoExiste.body);
      expect(err1.codigo).toBe('NO_AUTENTICADO');
      expect(err2.codigo).toBe('NO_AUTENTICADO');
      expect(err1.mensaje).toBe(err2.mensaje);
    });

    it('salir revoca la sesión y es idempotente sin cookie', async () => {
      const { cookie } = await crearSesionDePrueba(prueba);

      await http().get('/api/v1/auth/sesion').set('Cookie', cookie).expect(200);

      await http().post('/api/v1/auth/salir').set('Cookie', cookie).expect(204);

      await http().get('/api/v1/auth/sesion').set('Cookie', cookie).expect(401);

      // Idempotente sin cookie
      await http().post('/api/v1/auth/salir').expect(204);
    });
  });

  describe('vigencia de sesión y guards globales', () => {
    it('rechaza con 401 sesiones expiradas, revocadas, usuario inactivo o empresa inactiva', async () => {
      // Expirada
      const sesionExp = await crearSesionDePrueba(prueba);
      await prueba.db
        .update(sesiones)
        .set({ expiraEn: new Date(Date.now() - 60_000) })
        .where(eq(sesiones.usuarioId, sesionExp.usuario.id));
      await http().get('/api/v1/auth/sesion').set('Cookie', sesionExp.cookie).expect(401);

      // Revocada
      const sesionRev = await crearSesionDePrueba(prueba);
      await prueba.db
        .update(sesiones)
        .set({ revocadaEn: new Date() })
        .where(eq(sesiones.usuarioId, sesionRev.usuario.id));
      await http().get('/api/v1/auth/sesion').set('Cookie', sesionRev.cookie).expect(401);

      // Usuario inactivo
      const sesionUsrInactivo = await crearSesionDePrueba(prueba);
      await prueba.db
        .update(usuarios)
        .set({ activo: false })
        .where(eq(usuarios.id, sesionUsrInactivo.usuario.id));
      await http().get('/api/v1/auth/sesion').set('Cookie', sesionUsrInactivo.cookie).expect(401);

      // Empresa inactiva
      const sesionEmpInactiva = await crearSesionDePrueba(prueba);
      await prueba.db
        .update(empresas)
        .set({ activo: false })
        .where(eq(empresas.id, sesionEmpInactiva.empresa.id));
      await http().get('/api/v1/auth/sesion').set('Cookie', sesionEmpInactiva.cookie).expect(401);
    });

    it('exige sesión en rutas protegidas y permite health sin sesión', async () => {
      await http().get('/api/v1/prueba-auth/protegida').expect(401);
      await http().get('/api/v1/health').expect(200);
    });

    it('aplica @Roles sin jerarquía implícita (403 si no coincide, 200 si coincide)', async () => {
      const sesionDueno = await crearSesionDePrueba(prueba, { rol: 'dueno' });
      const sesionAdmin = await crearSesionDePrueba(prueba, { rol: 'admin' });

      // dueno no incluye admin si el endpoint solo lista @Roles('admin')
      const resProhibido = await http()
        .get('/api/v1/prueba-auth/solo-admin')
        .set('Cookie', sesionDueno.cookie)
        .expect(403);
      expect(errorApiSchema.parse(resProhibido.body).codigo).toBe('SIN_PERMISO');

      const resPermitido = await http()
        .get('/api/v1/prueba-auth/solo-admin')
        .set('Cookie', sesionAdmin.cookie)
        .expect(200);
      expect(resPermitido.body).toEqual({ empresaId: sesionAdmin.empresa.id });
    });

    it('verifica cabecera Origin en peticiones mutantes (403 si difiere de WEB_URL, 201 si coincide)', async () => {
      const { cookie } = await crearSesionDePrueba(prueba);

      const resBloqueado = await http()
        .post('/api/v1/prueba-auth/mutacion')
        .set('Cookie', cookie)
        .set('Origin', 'https://atacante.example')
        .expect(403);
      expect(errorApiSchema.parse(resBloqueado.body).codigo).toBe('SIN_PERMISO');

      await http()
        .post('/api/v1/prueba-auth/mutacion')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3000')
        .expect(201);
    });

    it('aplica el límite de intentos y responde 429 DEMASIADAS_SOLICITUDES al superarse', async () => {
      const ipFija = '198.51.100.42';

      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/v1/auth/registro')
          .set('X-Forwarded-For', ipFija)
          .send(datosRegistroValidos(`rate-${i}`))
          .expect(201);
      }

      const resBloqueado = await http()
        .post('/api/v1/auth/registro')
        .set('X-Forwarded-For', ipFija)
        .send(datosRegistroValidos('rate-extra'))
        .expect(429);

      expect(errorApiSchema.parse(resBloqueado.body).codigo).toBe('DEMASIADAS_SOLICITUDES');
    });

    it('publica los cuatro endpoints de autenticación en OpenAPI', async () => {
      const respuesta = await http().get('/api/docs-json').expect(200);
      const rutas = respuesta.body.paths as Record<string, unknown>;

      expect(rutas).toHaveProperty('/api/v1/auth/registro');
      expect(rutas).toHaveProperty('/api/v1/auth/ingresar');
      expect(rutas).toHaveProperty('/api/v1/auth/salir');
      expect(rutas).toHaveProperty('/api/v1/auth/sesion');
    });
  });
});
