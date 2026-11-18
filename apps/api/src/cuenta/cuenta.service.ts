import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TipoToken } from '@portfolio/contracts';
import argon2 from 'argon2';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception.js';
import type { Env } from '../config/env.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { sesiones, tokensVerificacion, usuarios } from '../db/schema.js';
import { Mailer } from '../mail/mailer.js';

const MS_POR_HORA = 60 * 60 * 1000;

/** Vigencias por tipo de token de un solo uso. */
export const VIGENCIA_TOKEN_MS: Readonly<Record<TipoToken, number>> = {
  verificar_correo: 24 * MS_POR_HORA,
  recuperar_contrasena: 1 * MS_POR_HORA,
};

/**
 * Calcula el hash SHA-256 en hexadecimal de un token de verificación o recuperación.
 *
 * Nunca se persiste el token en claro en `tokens_verificacion`: solo este hash,
 * de modo que una filtración de la base de datos no permita confirmar cuentas ni
 * restablecer contraseñas ajenas.
 */
export function hashTokenVerificacion(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Genera un token aleatorio de 32 bytes codificado en `base64url` junto con su
 * hash SHA-256 para almacenamiento seguro.
 */
export function generarTokenVerificacion(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashTokenVerificacion(token) };
}

/**
 * Calcula la fecha de expiración de un token según su propósito
 * (24 horas para verificar correo, 1 hora para recuperar contraseña).
 */
export function calcularExpiracionToken(tipo: TipoToken, ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() + VIGENCIA_TOKEN_MS[tipo]);
}

/**
 * Servicio de seguridad de cuenta: verificación de correo electrónico,
 * recuperación/restablecimiento de contraseña olvidada y cambio de contraseña
 * desde una sesión activa.
 *
 * **Invariantes de seguridad:**
 * - Los tokens de un solo uso se almacenan únicamente como hash SHA-256.
 * - Al emitir un token nuevo para `(usuarioId, tipo)` se invalidan todos los
 *   anteriores sin usar del mismo usuario y tipo dentro de la misma transacción.
 * - El consumo de tokens es atómico (`UPDATE ... WHERE usado_en IS NULL AND
 *   expira_en > ahora RETURNING ...`) para evitar usos concurrentes.
 * - `solicitarRecuperacion` siempre responde sin error aunque el correo no
 *   exista o la cuenta esté inactiva, evitando la enumeración de cuentas.
 * - Ningún token en claro, hash ni contraseña se escribe en los registros.
 */
@Injectable()
export class CuentaService {
  private readonly logger = new Logger(CuentaService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mailer: Mailer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Genera un token de verificación de correo (vigencia 24 h) y envía el enlace
   * al usuario.
   *
   * Es idempotente: si el correo ya fue verificado (`emailVerificadoEn !== null`)
   * o el usuario no está activo, termina sin enviar correo.
   */
  async enviarVerificacionCorreo(usuarioId: string): Promise<void> {
    const [usuario] = await this.db
      .select({
        id: usuarios.id,
        email: usuarios.email,
        nombre: usuarios.nombre,
        emailVerificadoEn: usuarios.emailVerificadoEn,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);

    if (!usuario || !usuario.activo || usuario.emailVerificadoEn !== null) {
      return;
    }

    const token = await this.emitirToken(usuario.id, 'verificar_correo');
    const webUrl = this.config.get('WEB_URL', { infer: true });
    const enlace = `${webUrl}/verificar?token=${encodeURIComponent(token)}`;

    await this.mailer.enviar({
      para: usuario.email,
      asunto: 'Verifica tu correo electrónico',
      html: `<p>Hola ${escaparHtml(usuario.nombre)},</p><p>Confirma tu correo electrónico ingresando al siguiente enlace (válido por 24 horas):</p><p><a href="${enlace}">${enlace}</a></p>`,
      texto: `Hola ${usuario.nombre},\n\nConfirma tu correo electrónico ingresando al siguiente enlace (válido por 24 horas):\n${enlace}`,
    });
  }

  /**
   * Consume un token de verificación de correo y marca el correo del usuario
   * como verificado.
   *
   * @throws AppException (`CONFLICTO`) si el token no existe, ya fue usado o expiró.
   */
  async verificarCorreo(token: string): Promise<void> {
    const tokenHash = hashTokenVerificacion(token);
    const ahora = new Date();

    await this.db.transaction(async (tx) => {
      const [consumido] = await tx
        .update(tokensVerificacion)
        .set({ usadoEn: ahora })
        .where(
          and(
            eq(tokensVerificacion.tokenHash, tokenHash),
            eq(tokensVerificacion.tipo, 'verificar_correo'),
            isNull(tokensVerificacion.usadoEn),
            gt(tokensVerificacion.expiraEn, ahora),
          ),
        )
        .returning({ usuarioId: tokensVerificacion.usuarioId });

      if (!consumido) {
        throw AppException.conflicto('El enlace de verificación es inválido o ya expiró');
      }

      await tx
        .update(usuarios)
        .set({ emailVerificadoEn: ahora })
        .where(eq(usuarios.id, consumido.usuarioId));
    });
  }

  /**
   * Inicia el flujo de recuperación de contraseña para un correo electrónico.
   *
   * Si existe un usuario activo con ese correo, emite un token de un solo uso
   * (vigencia 1 h) y envía el enlace de restablecimiento. Si no existe o está
   * inactivo, no envía correo y finaliza normalmente para evitar enumeración.
   */
  async solicitarRecuperacion(email: string): Promise<void> {
    const [usuario] = await this.db
      .select({
        id: usuarios.id,
        email: usuarios.email,
        nombre: usuarios.nombre,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);

    if (!usuario || !usuario.activo) {
      return;
    }

    const token = await this.emitirToken(usuario.id, 'recuperar_contrasena');
    const webUrl = this.config.get('WEB_URL', { infer: true });
    const enlace = `${webUrl}/restablecer?token=${encodeURIComponent(token)}`;

    await this.mailer.enviar({
      para: usuario.email,
      asunto: 'Recupera tu contraseña',
      html: `<p>Hola ${escaparHtml(usuario.nombre)},</p><p>Recibimos una solicitud para restablecer tu contraseña. Usa este enlace dentro de la próxima hora:</p><p><a href="${enlace}">${enlace}</a></p><p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>`,
      texto: `Hola ${usuario.nombre},\n\nRecibimos una solicitud para restablecer tu contraseña. Usa este enlace dentro de la próxima hora:\n${enlace}\n\nSi no solicitaste este cambio, puedes ignorar este mensaje.`,
    });
  }

  /**
   * Restablece la contraseña mediante un token de recuperación válido.
   *
   * En una única transacción consume el token, actualiza `passwordHash` con
   * Argon2id, invalida cualquier otro token de recuperación pendiente del
   * usuario y revoca todas sus sesiones activas.
   *
   * @throws AppException (`CONFLICTO`) si el token no existe, ya fue usado o expiró.
   */
  async restablecerContrasena(token: string, passwordNueva: string): Promise<void> {
    const tokenHash = hashTokenVerificacion(token);
    const ahora = new Date();

    const usuarioId = await this.db.transaction(async (tx) => {
      const [consumido] = await tx
        .update(tokensVerificacion)
        .set({ usadoEn: ahora })
        .where(
          and(
            eq(tokensVerificacion.tokenHash, tokenHash),
            eq(tokensVerificacion.tipo, 'recuperar_contrasena'),
            isNull(tokensVerificacion.usadoEn),
            gt(tokensVerificacion.expiraEn, ahora),
          ),
        )
        .returning({ usuarioId: tokensVerificacion.usuarioId });

      if (!consumido) {
        throw AppException.conflicto('El enlace de recuperación es inválido o ya expiró');
      }

      const passwordHash = await argon2.hash(passwordNueva, { type: argon2.argon2id });

      await tx.update(usuarios).set({ passwordHash }).where(eq(usuarios.id, consumido.usuarioId));

      await tx
        .update(tokensVerificacion)
        .set({ usadoEn: ahora })
        .where(
          and(
            eq(tokensVerificacion.usuarioId, consumido.usuarioId),
            eq(tokensVerificacion.tipo, 'recuperar_contrasena'),
            isNull(tokensVerificacion.usadoEn),
          ),
        );

      await tx
        .update(sesiones)
        .set({ revocadaEn: ahora })
        .where(and(eq(sesiones.usuarioId, consumido.usuarioId), isNull(sesiones.revocadaEn)));

      return consumido.usuarioId;
    });

    this.logger.log({ usuarioId }, 'Contraseña restablecida y sesiones revocadas');
  }

  /**
   * Cambia la contraseña del usuario autenticado tras verificar su contraseña
   * actual, manteniendo viva la sesión en curso y revocando todas las demás.
   *
   * @throws AppException (`NO_AUTENTICADO`) si el usuario no existe/está inactivo
   *   o si `passwordActual` no coincide con el hash almacenado.
   */
  async cambiarContrasena(
    usuarioId: string,
    sesionActualId: string,
    passwordActual: string,
    passwordNueva: string,
  ): Promise<void> {
    const [usuario] = await this.db
      .select({
        id: usuarios.id,
        passwordHash: usuarios.passwordHash,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);

    if (!usuario || !usuario.activo) {
      throw AppException.noAutenticado();
    }

    const coincide = await verificarArgon2(usuario.passwordHash, passwordActual);
    if (!coincide) {
      throw AppException.noAutenticado('La contraseña actual es incorrecta');
    }

    const nuevoHash = await argon2.hash(passwordNueva, { type: argon2.argon2id });
    const ahora = new Date();

    await this.db.transaction(async (tx) => {
      await tx.update(usuarios).set({ passwordHash: nuevoHash }).where(eq(usuarios.id, usuarioId));

      await tx
        .update(sesiones)
        .set({ revocadaEn: ahora })
        .where(
          and(
            eq(sesiones.usuarioId, usuarioId),
            ne(sesiones.id, sesionActualId),
            isNull(sesiones.revocadaEn),
          ),
        );
    });

    this.logger.log({ usuarioId }, 'Contraseña actualizada y otras sesiones revocadas');
  }

  /**
   * Invalida tokens previos sin usar del mismo `(usuarioId, tipo)` y persiste
   * un nuevo token en `tokens_verificacion`, devolviendo el valor en claro.
   */
  private async emitirToken(usuarioId: string, tipo: TipoToken): Promise<string> {
    const ahora = new Date();
    const { token, tokenHash } = generarTokenVerificacion();
    const expiraEn = calcularExpiracionToken(tipo, ahora);

    await this.db.transaction(async (tx) => {
      await tx
        .update(tokensVerificacion)
        .set({ usadoEn: ahora })
        .where(
          and(
            eq(tokensVerificacion.usuarioId, usuarioId),
            eq(tokensVerificacion.tipo, tipo),
            isNull(tokensVerificacion.usadoEn),
          ),
        );

      await tx.insert(tokensVerificacion).values({
        usuarioId,
        tipo,
        tokenHash,
        expiraEn,
      });
    });

    return token;
  }
}

async function verificarArgon2(hashAlmacenado: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hashAlmacenado, password);
  } catch {
    return false;
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
