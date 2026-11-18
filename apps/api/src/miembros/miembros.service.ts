import { Inject, Injectable } from '@nestjs/common';
import {
  idSchema,
  type ActualizarMiembro,
  type EmpresaDeUsuario,
  type Miembro,
  type Sesion,
} from '@portfolio/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ContextoSesion } from '../auth/auth.decorators.js';
import { AppException } from '../common/errors/app.exception.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { empresas, miembros, sesiones, usuarios } from '../db/schema.js';

/**
 * Servicio de gestión de miembros de la empresa y cambio de empresa activa.
 *
 * Centraliza las invariantes de equipo:
 * - Aislamiento estricto por `empresaId` de la sesión (`NO_ENCONTRADO` ante
 *   recursos ajenos o identificadores malformados).
 * - Un miembro no puede cambiar su propio rol ni desactivarse/eliminarse.
 * - Solo un `dueno` puede otorgar o quitar el rol `dueno`.
 * - Toda empresa conserva siempre al menos un `dueno` activo.
 * - Al desactivar o eliminar un miembro se revocan sus sesiones activas en esa empresa.
 */
@Injectable()
export class MiembrosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Lista todos los miembros (activos e inactivos) de la empresa activa,
   * ordenados por antigüedad de ingreso.
   */
  async listar(empresaId: string): Promise<Miembro[]> {
    const filas = await this.db
      .select({
        id: miembros.id,
        usuarioId: miembros.usuarioId,
        nombre: usuarios.nombre,
        email: usuarios.email,
        rol: miembros.rol,
        activo: miembros.activo,
        emailVerificadoEn: usuarios.emailVerificadoEn,
        creadoEn: miembros.creadoEn,
      })
      .from(miembros)
      .innerJoin(usuarios, eq(miembros.usuarioId, usuarios.id))
      .where(eq(miembros.empresaId, empresaId))
      .orderBy(asc(miembros.creadoEn));

    return filas.map((fila) => ({
      id: fila.id,
      usuarioId: fila.usuarioId,
      nombre: fila.nombre,
      email: fila.email,
      rol: fila.rol,
      activo: fila.activo,
      emailVerificado: fila.emailVerificadoEn !== null,
      creadoEn: fila.creadoEn.toISOString(),
    }));
  }

  /**
   * Actualiza el rol y/o el estado `activo` de un miembro dentro de una
   * transacción, aplicando las reglas de jerarquía de `dueno` y revocando
   * sesiones si se desactiva.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el miembro no existe o pertenece a otra empresa.
   * @throws AppException (`CONFLICTO`) si intenta modificarse a sí mismo o dejar la empresa sin dueño activo.
   * @throws AppException (`SIN_PERMISO`) si un no-dueño intenta otorgar o quitar el rol `dueno`.
   */
  async actualizar(
    empresaId: string,
    miembroId: string,
    datos: ActualizarMiembro,
    actor: ContextoSesion,
  ): Promise<Miembro> {
    if (!idSchema.safeParse(miembroId).success) {
      throw AppException.noEncontrado('El miembro no existe');
    }

    return this.db.transaction(async (tx) => {
      const [objetivo] = await tx
        .select({
          id: miembros.id,
          usuarioId: miembros.usuarioId,
          nombre: usuarios.nombre,
          email: usuarios.email,
          rol: miembros.rol,
          activo: miembros.activo,
          emailVerificadoEn: usuarios.emailVerificadoEn,
          creadoEn: miembros.creadoEn,
        })
        .from(miembros)
        .innerJoin(usuarios, eq(miembros.usuarioId, usuarios.id))
        .where(and(eq(miembros.id, miembroId), eq(miembros.empresaId, empresaId)))
        .limit(1);

      if (!objetivo) {
        throw AppException.noEncontrado('El miembro no existe');
      }

      if (objetivo.usuarioId === actor.usuario.id) {
        throw AppException.conflicto(
          'No puedes modificar tu propio rol ni desactivarte a ti mismo',
        );
      }

      const involucraDueno = objetivo.rol === 'dueno' || datos.rol === 'dueno';
      if (involucraDueno && actor.rol !== 'dueno') {
        throw AppException.sinPermiso('Solo un dueño puede otorgar o quitar el rol de dueño');
      }

      const dejaDeSerDuenoActivo =
        objetivo.rol === 'dueno' &&
        objetivo.activo &&
        ((datos.rol !== undefined && datos.rol !== 'dueno') || datos.activo === false);

      if (dejaDeSerDuenoActivo) {
        await this.asegurarOtroDuenoActivo(tx, empresaId, objetivo.id);
      }

      const nuevoRol = datos.rol ?? objetivo.rol;
      const nuevoActivo = datos.activo ?? objetivo.activo;

      await tx
        .update(miembros)
        .set({ rol: nuevoRol, activo: nuevoActivo })
        .where(and(eq(miembros.id, miembroId), eq(miembros.empresaId, empresaId)));

      if (datos.activo === false) {
        await this.revocarSesionesMiembro(tx, empresaId, objetivo.usuarioId);
      }

      return {
        id: objetivo.id,
        usuarioId: objetivo.usuarioId,
        nombre: objetivo.nombre,
        email: objetivo.email,
        rol: nuevoRol,
        activo: nuevoActivo,
        emailVerificado: objetivo.emailVerificadoEn !== null,
        creadoEn: objetivo.creadoEn.toISOString(),
      };
    });
  }

  /**
   * Elimina un miembro de la empresa y revoca sus sesiones activas en ella.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el miembro no existe o pertenece a otra empresa.
   * @throws AppException (`CONFLICTO`) si intenta eliminarse a sí mismo o al último dueño activo.
   * @throws AppException (`SIN_PERMISO`) si un no-dueño intenta eliminar a un dueño.
   */
  async eliminar(empresaId: string, miembroId: string, actor: ContextoSesion): Promise<void> {
    if (!idSchema.safeParse(miembroId).success) {
      throw AppException.noEncontrado('El miembro no existe');
    }

    await this.db.transaction(async (tx) => {
      const [objetivo] = await tx
        .select({
          id: miembros.id,
          usuarioId: miembros.usuarioId,
          rol: miembros.rol,
          activo: miembros.activo,
        })
        .from(miembros)
        .where(and(eq(miembros.id, miembroId), eq(miembros.empresaId, empresaId)))
        .limit(1);

      if (!objetivo) {
        throw AppException.noEncontrado('El miembro no existe');
      }

      if (objetivo.usuarioId === actor.usuario.id) {
        throw AppException.conflicto('No puedes eliminarte a ti mismo de la empresa');
      }

      if (objetivo.rol === 'dueno' && actor.rol !== 'dueno') {
        throw AppException.sinPermiso('Solo un dueño puede eliminar a otro dueño');
      }

      if (objetivo.rol === 'dueno' && objetivo.activo) {
        await this.asegurarOtroDuenoActivo(tx, empresaId, objetivo.id);
      }

      await tx
        .delete(miembros)
        .where(and(eq(miembros.id, miembroId), eq(miembros.empresaId, empresaId)));

      await this.revocarSesionesMiembro(tx, empresaId, objetivo.usuarioId);
    });
  }

  /**
   * Lista las empresas activas donde el usuario autenticado posee una
   * membresía activa, marcando cuál es la empresa activa en la sesión.
   */
  async listarEmpresasDeUsuario(actor: ContextoSesion): Promise<EmpresaDeUsuario[]> {
    const filas = await this.db
      .select({
        id: empresas.id,
        nombre: empresas.nombre,
        slug: empresas.slug,
        rol: miembros.rol,
      })
      .from(miembros)
      .innerJoin(empresas, eq(miembros.empresaId, empresas.id))
      .where(
        and(
          eq(miembros.usuarioId, actor.usuario.id),
          eq(miembros.activo, true),
          eq(empresas.activo, true),
        ),
      )
      .orderBy(asc(miembros.creadoEn));

    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      slug: fila.slug,
      rol: fila.rol,
      activa: fila.id === actor.empresa.id,
    }));
  }

  /**
   * Cambia `sesiones.empresa_id` de la sesión actual a otra empresa en la que
   * el usuario tenga membresía activa y la empresa esté activa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el usuario no pertenece a esa empresa o está inactiva.
   */
  async cambiarEmpresaActiva(empresaId: string, actor: ContextoSesion): Promise<Sesion> {
    const [fila] = await this.db
      .select({
        id: empresas.id,
        nombre: empresas.nombre,
        slug: empresas.slug,
        zonaHoraria: empresas.zonaHoraria,
        moneda: empresas.moneda,
        rol: miembros.rol,
      })
      .from(miembros)
      .innerJoin(empresas, eq(miembros.empresaId, empresas.id))
      .where(
        and(
          eq(miembros.usuarioId, actor.usuario.id),
          eq(miembros.empresaId, empresaId),
          eq(miembros.activo, true),
          eq(empresas.activo, true),
        ),
      )
      .limit(1);

    if (!fila) {
      throw AppException.noEncontrado('No perteneces a esa empresa o no está activa');
    }

    await this.db
      .update(sesiones)
      .set({ empresaId: fila.id })
      .where(eq(sesiones.id, actor.sesionId));

    return {
      usuario: actor.usuario,
      empresa: {
        id: fila.id,
        nombre: fila.nombre,
        slug: fila.slug,
        zonaHoraria: fila.zonaHoraria,
        moneda: fila.moneda,
      },
      rol: fila.rol,
    };
  }

  private async asegurarOtroDuenoActivo(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    empresaId: string,
    miembroExcluidoId: string,
  ): Promise<void> {
    const duenosActivos = await tx
      .select({ id: miembros.id })
      .from(miembros)
      .where(
        and(
          eq(miembros.empresaId, empresaId),
          eq(miembros.rol, 'dueno'),
          eq(miembros.activo, true),
        ),
      )
      .for('update');

    const quedanOtros = duenosActivos.some((dueno) => dueno.id !== miembroExcluidoId);
    if (!quedanOtros) {
      throw AppException.conflicto('La empresa debe conservar al menos un dueño activo');
    }
  }

  private async revocarSesionesMiembro(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    empresaId: string,
    usuarioId: string,
  ): Promise<void> {
    await tx
      .update(sesiones)
      .set({ revocadaEn: new Date() })
      .where(
        and(
          eq(sesiones.usuarioId, usuarioId),
          eq(sesiones.empresaId, empresaId),
          isNull(sesiones.revocadaEn),
        ),
      );
  }
}
