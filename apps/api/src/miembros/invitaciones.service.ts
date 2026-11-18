import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  idSchema,
  type AceptarInvitacion,
  type CrearInvitacion,
  type DetalleError,
  type DetalleInvitacionPublica,
  type Invitacion,
  type Sesion,
} from '@portfolio/contracts';
import * as argon2 from 'argon2';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import type { ContextoSesion } from '../auth/auth.decorators.js';
import {
  SessionService,
  hashTokenSesion,
  type ContextoCreacionSesion,
} from '../auth/session.service.js';
import { AppException } from '../common/errors/app.exception.js';
import type { Env } from '../config/env.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { empresas, invitaciones, miembros, usuarios } from '../db/schema.js';
import { Mailer } from '../mail/mailer.js';

const DIAS_VIGENCIA_INVITACION = 7;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Servicio de ciclo de vida de invitaciones (creación interna, revocación y
 * aceptación pública con cuenta nueva o existente).
 *
 * Seguridad:
 * - El token en claro (32 bytes aleatorios) solo viaja en el enlace del correo
 *   y nunca se persiste ni se registra en logs; en `invitaciones.token_hash`
 *   se almacena únicamente su SHA-256 en hexadecimal.
 * - La aceptación marca `aceptada_en` de forma atómica (`WHERE aceptada_en IS NULL`)
 *   para impedir doble uso bajo concurrencia.
 * - Si la invitación no existe responde `404 NO_ENCONTRADO`; si ya fue usada
 *   o expiró responde `409 CONFLICTO`.
 */
@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<Env, true>,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Lista las invitaciones pendientes (no aceptadas y vigentes) de la empresa activa.
   */
  async listar(empresaId: string): Promise<Invitacion[]> {
    const ahora = new Date();
    const filas = await this.db
      .select({
        id: invitaciones.id,
        email: invitaciones.email,
        rol: invitaciones.rol,
        expiraEn: invitaciones.expiraEn,
        creadoEn: invitaciones.creadoEn,
      })
      .from(invitaciones)
      .where(
        and(
          eq(invitaciones.empresaId, empresaId),
          isNull(invitaciones.aceptadaEn),
          gt(invitaciones.expiraEn, ahora),
        ),
      )
      .orderBy(asc(invitaciones.creadoEn));

    return filas.map((fila) => ({
      id: fila.id,
      email: fila.email,
      rol: fila.rol,
      expiraEn: fila.expiraEn.toISOString(),
      creadoEn: fila.creadoEn.toISOString(),
    }));
  }

  /**
   * Crea una invitación para un correo en la empresa activa, invalida
   * cualquier invitación pendiente previa al mismo correo en esa empresa y
   * envía el enlace por correo.
   *
   * @throws AppException (`SIN_PERMISO`) si un no-dueño intenta invitar con rol `dueno`.
   * @throws AppException (`CONFLICTO`) si el correo ya pertenece a un miembro de la empresa.
   */
  async crear(
    empresaId: string,
    datos: CrearInvitacion,
    actor: ContextoSesion,
  ): Promise<Invitacion> {
    if (datos.rol === 'dueno' && actor.rol !== 'dueno') {
      throw AppException.sinPermiso('Solo un dueño puede invitar con rol de dueño');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashTokenSesion(token);
    const expiraEn = new Date(Date.now() + DIAS_VIGENCIA_INVITACION * MS_POR_DIA);

    const creada = await this.db.transaction(async (tx) => {
      const [miembroExistente] = await tx
        .select({ id: miembros.id })
        .from(miembros)
        .innerJoin(usuarios, eq(miembros.usuarioId, usuarios.id))
        .where(and(eq(miembros.empresaId, empresaId), eq(usuarios.email, datos.email)))
        .limit(1);

      if (miembroExistente) {
        throw AppException.conflicto('Esta persona ya es miembro de la empresa');
      }

      // Reemplaza invitaciones pendientes previas del mismo correo en esta empresa.
      await tx
        .delete(invitaciones)
        .where(
          and(
            eq(invitaciones.empresaId, empresaId),
            eq(invitaciones.email, datos.email),
            isNull(invitaciones.aceptadaEn),
          ),
        );

      const [fila] = await tx
        .insert(invitaciones)
        .values({
          empresaId,
          email: datos.email,
          rol: datos.rol,
          tokenHash,
          invitadoPorId: actor.usuario.id,
          expiraEn,
        })
        .returning({
          id: invitaciones.id,
          email: invitaciones.email,
          rol: invitaciones.rol,
          expiraEn: invitaciones.expiraEn,
          creadoEn: invitaciones.creadoEn,
        });

      if (!fila) {
        throw new Error('No se pudo registrar la invitación');
      }

      return fila;
    });

    const webUrl = this.config.get('WEB_URL', { infer: true });
    const enlace = `${webUrl}/invitacion?token=${token}`;

    await this.mailer.enviar({
      para: datos.email,
      asunto: `Invitación a unirte a ${actor.empresa.nombre}`,
      texto:
        `Hola,\n\n` +
        `Te invitaron a unirte a ${actor.empresa.nombre} con el rol "${datos.rol}".\n` +
        `Para aceptar la invitación, abre el siguiente enlace (válido por 7 días):\n` +
        `${enlace}\n`,
      html:
        `<p>Hola,</p>` +
        `<p>Te invitaron a unirte a <strong>${escaparHtml(actor.empresa.nombre)}</strong> con el rol <strong>${escaparHtml(datos.rol)}</strong>.</p>` +
        `<p><a href="${enlace}">Aceptar invitación</a> (válido por 7 días).</p>`,
    });

    this.logger.log(`Invitación ${creada.id} creada para empresa ${empresaId}`);

    return {
      id: creada.id,
      email: creada.email,
      rol: creada.rol,
      expiraEn: creada.expiraEn.toISOString(),
      creadoEn: creada.creadoEn.toISOString(),
    };
  }

  /**
   * Revoca (elimina) una invitación de la empresa activa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si la invitación no existe o pertenece a otra empresa.
   */
  async revocar(empresaId: string, invitacionId: string): Promise<void> {
    if (!idSchema.safeParse(invitacionId).success) {
      throw AppException.noEncontrado('La invitación no existe');
    }

    const eliminadas = await this.db
      .delete(invitaciones)
      .where(and(eq(invitaciones.id, invitacionId), eq(invitaciones.empresaId, empresaId)))
      .returning({ id: invitaciones.id });

    if (eliminadas.length === 0) {
      throw AppException.noEncontrado('La invitación no existe');
    }
  }

  /**
   * Consulta el estado público de una invitación mediante su token en claro.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el token no existe.
   * @throws AppException (`CONFLICTO`) si ya fue aceptada o expiró.
   */
  async obtenerDetallePublico(token: string): Promise<DetalleInvitacionPublica> {
    const tokenHash = hashTokenSesion(token);
    const [fila] = await this.db
      .select({
        email: invitaciones.email,
        rol: invitaciones.rol,
        expiraEn: invitaciones.expiraEn,
        aceptadaEn: invitaciones.aceptadaEn,
        empresaNombre: empresas.nombre,
      })
      .from(invitaciones)
      .innerJoin(empresas, eq(invitaciones.empresaId, empresas.id))
      .where(eq(invitaciones.tokenHash, tokenHash))
      .limit(1);

    if (!fila) {
      throw AppException.noEncontrado('La invitación no existe');
    }

    if (fila.aceptadaEn !== null) {
      throw AppException.conflicto('La invitación ya fue utilizada');
    }

    if (fila.expiraEn.getTime() <= Date.now()) {
      throw AppException.conflicto('La invitación ha expirado');
    }

    const [usuarioExistente] = await this.db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, fila.email))
      .limit(1);

    return {
      email: fila.email,
      rol: fila.rol,
      empresaNombre: fila.empresaNombre,
      usuarioExiste: Boolean(usuarioExistente),
      expiraEn: fila.expiraEn.toISOString(),
    };
  }

  /**
   * Acepta una invitación de un solo uso y abre sesión en la empresa invitante.
   *
   * - Si el correo no tiene cuenta, exige `nombre` y `password`, crea el usuario
   *   con `email_verificado_en` marcado y crea la membresía.
   * - Si el correo ya tiene cuenta, exige una sesión activa perteneciente a ese
   *   mismo correo y crea la membresía.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el token no existe.
   * @throws AppException (`CONFLICTO`) si ya fue usada, expiró o ya es miembro.
   * @throws AppException (`VALIDACION`) si falta `nombre` o `password` para usuario nuevo.
   * @throws AppException (`NO_AUTENTICADO` | `SIN_PERMISO`) si el usuario existe y no hay sesión válida del mismo correo.
   */
  async aceptarPublico(
    token: string,
    datos: AceptarInvitacion,
    tokenSesionActual: string | undefined,
    contextoHttp: ContextoCreacionSesion,
  ): Promise<{ sesion: Sesion; token: string }> {
    const tokenHash = hashTokenSesion(token);

    const [invitacionPrevia] = await this.db
      .select({
        id: invitaciones.id,
        email: invitaciones.email,
        aceptadaEn: invitaciones.aceptadaEn,
        expiraEn: invitaciones.expiraEn,
      })
      .from(invitaciones)
      .where(eq(invitaciones.tokenHash, tokenHash))
      .limit(1);

    if (!invitacionPrevia) {
      throw AppException.noEncontrado('La invitación no existe');
    }
    if (invitacionPrevia.aceptadaEn !== null) {
      throw AppException.conflicto('La invitación ya fue utilizada');
    }
    if (invitacionPrevia.expiraEn.getTime() <= Date.now()) {
      throw AppException.conflicto('La invitación ha expirado');
    }

    const [usuarioPrevio] = await this.db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, invitacionPrevia.email))
      .limit(1);

    let passwordHashNuevo: string | undefined;
    let sesionExistenteValidada: ContextoSesion | null = null;

    if (!usuarioPrevio) {
      const detalles: DetalleError[] = [];
      if (!datos.nombre) {
        detalles.push({ campo: 'nombre', mensaje: 'El nombre es obligatorio' });
      }
      if (!datos.password) {
        detalles.push({ campo: 'password', mensaje: 'La contraseña es obligatoria' });
      }
      if (detalles.length > 0) {
        throw AppException.validacion(detalles);
      }
      passwordHashNuevo = await argon2.hash(datos.password!);
    } else {
      if (!tokenSesionActual) {
        throw AppException.noAutenticado(
          'Debes iniciar sesión con tu cuenta para aceptar esta invitación',
        );
      }
      sesionExistenteValidada = await this.sessionService.validar(tokenSesionActual);
      if (!sesionExistenteValidada) {
        throw AppException.noAutenticado(
          'Debes iniciar sesión con tu cuenta para aceptar esta invitación',
        );
      }
      if (sesionExistenteValidada.usuario.email !== invitacionPrevia.email) {
        throw AppException.sinPermiso('La sesión activa pertenece a otro correo electrónico');
      }
    }

    const resultado = await this.db.transaction(async (tx) => {
      const ahora = new Date();
      const [inv] = await tx
        .select({
          id: invitaciones.id,
          empresaId: invitaciones.empresaId,
          email: invitaciones.email,
          rol: invitaciones.rol,
          expiraEn: invitaciones.expiraEn,
          aceptadaEn: invitaciones.aceptadaEn,
          empresaNombre: empresas.nombre,
          empresaSlug: empresas.slug,
          zonaHoraria: empresas.zonaHoraria,
          moneda: empresas.moneda,
          empresaActiva: empresas.activo,
        })
        .from(invitaciones)
        .innerJoin(empresas, eq(invitaciones.empresaId, empresas.id))
        .where(eq(invitaciones.tokenHash, tokenHash))
        .limit(1);

      if (!inv) {
        throw AppException.noEncontrado('La invitación no existe');
      }
      if (inv.aceptadaEn !== null) {
        throw AppException.conflicto('La invitación ya fue utilizada');
      }
      if (inv.expiraEn.getTime() <= ahora.getTime()) {
        throw AppException.conflicto('La invitación ha expirado');
      }
      if (!inv.empresaActiva) {
        throw AppException.conflicto('La empresa no está activa');
      }

      // Actualización atómica para garantizar un solo uso bajo concurrencia.
      const [marcada] = await tx
        .update(invitaciones)
        .set({ aceptadaEn: ahora })
        .where(and(eq(invitaciones.id, inv.id), isNull(invitaciones.aceptadaEn)))
        .returning({ id: invitaciones.id });

      if (!marcada) {
        throw AppException.conflicto('La invitación ya fue utilizada');
      }

      let usuarioSesion: Sesion['usuario'];

      if (sesionExistenteValidada) {
        usuarioSesion = sesionExistenteValidada.usuario;
      } else {
        const [nuevoUsuario] = await tx
          .insert(usuarios)
          .values({
            email: inv.email,
            nombre: datos.nombre!,
            passwordHash: passwordHashNuevo!,
            emailVerificadoEn: ahora,
          })
          .returning({
            id: usuarios.id,
            nombre: usuarios.nombre,
            email: usuarios.email,
            emailVerificadoEn: usuarios.emailVerificadoEn,
          });

        if (!nuevoUsuario) {
          throw new Error('No se pudo crear el usuario');
        }

        usuarioSesion = {
          id: nuevoUsuario.id,
          nombre: nuevoUsuario.nombre,
          email: nuevoUsuario.email,
          emailVerificado: nuevoUsuario.emailVerificadoEn !== null,
        };
      }

      const [yaEsMiembro] = await tx
        .select({ id: miembros.id })
        .from(miembros)
        .where(and(eq(miembros.empresaId, inv.empresaId), eq(miembros.usuarioId, usuarioSesion.id)))
        .limit(1);

      if (yaEsMiembro) {
        throw AppException.conflicto('Ya eres miembro de esta empresa');
      }

      await tx.insert(miembros).values({
        empresaId: inv.empresaId,
        usuarioId: usuarioSesion.id,
        rol: inv.rol,
        activo: true,
      });

      const sesion: Sesion = {
        usuario: usuarioSesion,
        empresa: {
          id: inv.empresaId,
          nombre: inv.empresaNombre,
          slug: inv.empresaSlug,
          zonaHoraria: inv.zonaHoraria,
          moneda: inv.moneda,
        },
        rol: inv.rol,
      };

      return { sesion };
    });

    const nuevoToken = await this.sessionService.crear(
      resultado.sesion.usuario.id,
      resultado.sesion.empresa.id,
      contextoHttp,
    );

    return { sesion: resultado.sesion, token: nuevoToken };
  }
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
