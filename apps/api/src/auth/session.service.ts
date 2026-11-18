import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { empresas, miembros, sesiones, usuarios } from '../db/schema.js';
import type { ContextoSesion } from './auth.decorators.js';

const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

export interface ContextoCreacionSesion {
  ip?: string;
  userAgent?: string;
}

export interface EstadoVigenciaSesion {
  expiraEn: Date;
  revocadaEn: Date | null;
  ultimoUsoEn: Date;
  usuarioActivo: boolean;
  empresaActiva: boolean;
  miembroActivo: boolean;
}

export interface ResultadoVigenciaSesion {
  vigente: boolean;
  debeRenovar: boolean;
}

/**
 * Calcula el hash SHA-256 en hexadecimal de un token de sesión.
 * Se guarda solo este hash en la base de datos para que una filtración de
 * tablas no permita suplantar sesiones activas.
 */
export function hashTokenSesion(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Evalúa si una sesión sigue vigente y si corresponde deslizar su vencimiento.
 *
 * La renovación deslizante se limita a una vez por hora (`MS_POR_HORA`) para
 * evitar una escritura en `sesiones` en cada petición autenticada.
 */
export function evaluarVigenciaSesion(
  estado: EstadoVigenciaSesion,
  ahora: Date = new Date(),
): ResultadoVigenciaSesion {
  const vigente =
    estado.revocadaEn === null &&
    estado.expiraEn.getTime() > ahora.getTime() &&
    estado.usuarioActivo &&
    estado.empresaActiva &&
    estado.miembroActivo;

  if (!vigente) {
    return { vigente: false, debeRenovar: false };
  }

  const transcurridoMs = ahora.getTime() - estado.ultimoUsoEn.getTime();
  return {
    vigente: true,
    debeRenovar: transcurridoMs >= MS_POR_HORA,
  };
}

/**
 * Gestiona el ciclo de vida de las sesiones opacas en PostgreSQL.
 *
 * Cada sesión emite un token aleatorio de 32 bytes (en claro solo al crearla)
 * y persiste únicamente su hash SHA-256 en `sesiones.token_hash`.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Crea una nueva sesión para `(usuarioId, empresaId)` y devuelve el token en
   * claro una única vez para escribirlo en la cookie `httpOnly`.
   */
  async crear(
    usuarioId: string,
    empresaId: string,
    contexto: ContextoCreacionSesion = {},
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashTokenSesion(token);
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + this.ttlMs());

    await this.db.insert(sesiones).values({
      usuarioId,
      empresaId,
      tokenHash,
      expiraEn,
      ultimoUsoEn: ahora,
      ip: contexto.ip ? contexto.ip.slice(0, 45) : null,
      userAgent: contexto.userAgent ?? null,
    });

    return token;
  }

  /**
   * Valida un token de sesión y devuelve el contexto de usuario, empresa y rol,
   * o `null` si la sesión no existe, expiró, fue revocada o alguno de los
   * registros asociados (usuario, empresa o membresía) está inactivo.
   *
   * Si la sesión es válida y pasó al menos una hora desde `ultimo_uso_en`,
   * desliza `expira_en` y actualiza `ultimo_uso_en`.
   */
  async validar(token: string): Promise<ContextoSesion | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashTokenSesion(token);
    const filas = await this.db
      .select({
        sesionId: sesiones.id,
        expiraEn: sesiones.expiraEn,
        revocadaEn: sesiones.revocadaEn,
        ultimoUsoEn: sesiones.ultimoUsoEn,
        usuarioId: usuarios.id,
        usuarioNombre: usuarios.nombre,
        usuarioEmail: usuarios.email,
        emailVerificadoEn: usuarios.emailVerificadoEn,
        usuarioActivo: usuarios.activo,
        empresaId: empresas.id,
        empresaNombre: empresas.nombre,
        empresaSlug: empresas.slug,
        zonaHoraria: empresas.zonaHoraria,
        moneda: empresas.moneda,
        empresaActiva: empresas.activo,
        rol: miembros.rol,
        miembroActivo: miembros.activo,
      })
      .from(sesiones)
      .innerJoin(usuarios, eq(sesiones.usuarioId, usuarios.id))
      .innerJoin(empresas, eq(sesiones.empresaId, empresas.id))
      .innerJoin(
        miembros,
        and(eq(miembros.usuarioId, sesiones.usuarioId), eq(miembros.empresaId, sesiones.empresaId)),
      )
      .where(eq(sesiones.tokenHash, tokenHash))
      .limit(1);

    const fila = filas[0];
    if (!fila) {
      return null;
    }

    const ahora = new Date();
    const { vigente, debeRenovar } = evaluarVigenciaSesion(
      {
        expiraEn: fila.expiraEn,
        revocadaEn: fila.revocadaEn,
        ultimoUsoEn: fila.ultimoUsoEn,
        usuarioActivo: fila.usuarioActivo,
        empresaActiva: fila.empresaActiva,
        miembroActivo: fila.miembroActivo,
      },
      ahora,
    );

    if (!vigente) {
      return null;
    }

    if (debeRenovar) {
      await this.db
        .update(sesiones)
        .set({
          ultimoUsoEn: ahora,
          expiraEn: new Date(ahora.getTime() + this.ttlMs()),
        })
        .where(eq(sesiones.id, fila.sesionId));
    }

    return {
      sesionId: fila.sesionId,
      usuario: {
        id: fila.usuarioId,
        nombre: fila.usuarioNombre,
        email: fila.usuarioEmail,
        emailVerificado: fila.emailVerificadoEn !== null,
      },
      empresa: {
        id: fila.empresaId,
        nombre: fila.empresaNombre,
        slug: fila.empresaSlug,
        zonaHoraria: fila.zonaHoraria,
        moneda: fila.moneda,
      },
      rol: fila.rol,
    };
  }

  /**
   * Revoca la sesión correspondiente al token entregado marcando `revocada_en`.
   * Es idempotente: si el token no existe o ya estaba revocado, no falla.
   */
  async revocar(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = hashTokenSesion(token);
    await this.db
      .update(sesiones)
      .set({ revocadaEn: new Date() })
      .where(and(eq(sesiones.tokenHash, tokenHash), isNull(sesiones.revocadaEn)));
  }

  private ttlMs(): number {
    return this.config.get('SESSION_TTL_DIAS', { infer: true }) * MS_POR_DIA;
  }
}
