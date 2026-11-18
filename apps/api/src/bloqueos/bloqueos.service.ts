import { Inject, Injectable } from '@nestjs/common';
import {
  idSchema,
  type ActualizarBloqueo,
  type Bloqueo,
  type ConsultaBloqueos,
  type CrearBloqueo,
  type ResultadoBloqueo,
} from '@portfolio/contracts';
import { and, asc, count, eq, gt, lt, ne, type SQL } from 'drizzle-orm';
import type { ContextoSesion } from '../auth/auth.decorators.js';
import { AppException } from '../common/errors/app.exception.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { bloqueos, profesionales, reservas } from '../db/schema.js';

type ClienteDb = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
type FilaBloqueo = typeof bloqueos.$inferSelect;

/**
 * Servicio de gestión de bloqueos puntuales de disponibilidad.
 *
 * Centraliza las reglas de excepciones sobre el calendario:
 * - Aislamiento estricto por `empresaId` de la sesión (`NO_ENCONTRADO` ante
 *   recursos ajenos o identificadores malformados).
 * - Un bloqueo con `profesionalId === null` afecta a toda la empresa y solo
 *   puede ser creado, editado o eliminado por `dueno` o `admin`.
 * - Un miembro con rol `profesional` solo puede gestionar bloqueos asociados al
 *   registro de profesional vinculado a su cuenta (`SIN_PERMISO`).
 * - Al crear o editar un bloqueo, devuelve el conteo de reservas activas
 *   (`estado !== 'cancelada'`) cuyo tramo `[fechaHoraInicio, bloqueoHasta)` se
 *   solapa con `[inicio, fin)`.
 */
@Injectable()
export class BloqueosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Lista los bloqueos de la empresa activa filtrados opcionalmente por rango
   * `[desde, hasta]` y `profesionalId`, ordenados por `inicio ASC`.
   */
  async listar(empresaId: string, consulta: ConsultaBloqueos): Promise<Bloqueo[]> {
    const condiciones: SQL[] = [eq(bloqueos.empresaId, empresaId)];

    if (consulta.desde !== undefined) {
      condiciones.push(gt(bloqueos.fin, new Date(consulta.desde)));
    }

    if (consulta.hasta !== undefined) {
      condiciones.push(lt(bloqueos.inicio, new Date(consulta.hasta)));
    }

    if (consulta.profesionalId !== undefined) {
      condiciones.push(eq(bloqueos.profesionalId, consulta.profesionalId));
    }

    const filas = await this.db
      .select()
      .from(bloqueos)
      .where(and(...condiciones))
      .orderBy(asc(bloqueos.inicio), asc(bloqueos.id));

    return filas.map((fila) => this.serializar(fila));
  }

  /**
   * Crea un bloqueo puntual de disponibilidad y calcula cuántas reservas
   * activas quedan afectadas por el nuevo intervalo.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el `profesionalId` indicado no existe en la empresa.
   * @throws AppException (`SIN_PERMISO`) si un `profesional` intenta crear un bloqueo de empresa o de otro profesional.
   */
  async crear(sesion: ContextoSesion, datos: CrearBloqueo): Promise<ResultadoBloqueo> {
    const inicio = new Date(datos.inicio);
    const fin = new Date(datos.fin);

    if (inicio.getTime() >= fin.getTime()) {
      throw AppException.validacion([
        { campo: 'fin', mensaje: 'La fecha de inicio debe ser anterior a la fecha de fin' },
      ]);
    }

    return this.db.transaction(async (tx) => {
      await this.asegurarPermisoProfesional(tx, sesion, datos.profesionalId);

      const [creado] = await tx
        .insert(bloqueos)
        .values({
          empresaId: sesion.empresa.id,
          profesionalId: datos.profesionalId,
          inicio,
          fin,
          motivo: datos.motivo ?? null,
        })
        .returning();

      if (!creado) {
        throw AppException.noEncontrado('No se pudo crear el bloqueo');
      }

      const reservasAfectadas = await this.contarReservasAfectadas(
        tx,
        sesion.empresa.id,
        creado.profesionalId,
        creado.inicio,
        creado.fin,
      );

      return {
        bloqueo: this.serializar(creado),
        reservasAfectadas,
      };
    });
  }

  /**
   * Actualiza parcialmente un bloqueo existente y recalcula las reservas
   * activas afectadas por el intervalo resultante.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el bloqueo no existe en la empresa.
   * @throws AppException (`SIN_PERMISO`) si un `profesional` intenta editar un bloqueo de empresa o de otro profesional.
   * @throws AppException (`VALIDACION`) si el rango resultante no cumple `inicio < fin`.
   */
  async actualizar(
    sesion: ContextoSesion,
    id: string,
    datos: ActualizarBloqueo,
  ): Promise<ResultadoBloqueo> {
    return this.db.transaction(async (tx) => {
      const existente = await this.asegurarBloqueoEditable(tx, sesion, id);

      const nuevoInicio = datos.inicio !== undefined ? new Date(datos.inicio) : existente.inicio;
      const nuevoFin = datos.fin !== undefined ? new Date(datos.fin) : existente.fin;

      if (nuevoInicio.getTime() >= nuevoFin.getTime()) {
        throw AppException.validacion([
          { campo: 'fin', mensaje: 'La fecha de inicio debe ser anterior a la fecha de fin' },
        ]);
      }

      const cambios: Partial<typeof bloqueos.$inferInsert> = {
        inicio: nuevoInicio,
        fin: nuevoFin,
      };
      if (datos.motivo !== undefined) {
        cambios.motivo = datos.motivo;
      }

      const [actualizado] = await tx
        .update(bloqueos)
        .set(cambios)
        .where(and(eq(bloqueos.id, id), eq(bloqueos.empresaId, sesion.empresa.id)))
        .returning();

      if (!actualizado) {
        throw AppException.noEncontrado('El bloqueo no existe');
      }

      const reservasAfectadas = await this.contarReservasAfectadas(
        tx,
        sesion.empresa.id,
        actualizado.profesionalId,
        actualizado.inicio,
        actualizado.fin,
      );

      return {
        bloqueo: this.serializar(actualizado),
        reservasAfectadas,
      };
    });
  }

  /**
   * Elimina un bloqueo puntual de disponibilidad de la empresa activa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el bloqueo no existe en la empresa.
   * @throws AppException (`SIN_PERMISO`) si un `profesional` intenta eliminar un bloqueo de empresa o de otro profesional.
   */
  async eliminar(sesion: ContextoSesion, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.asegurarBloqueoEditable(tx, sesion, id);

      await tx
        .delete(bloqueos)
        .where(and(eq(bloqueos.id, id), eq(bloqueos.empresaId, sesion.empresa.id)));
    });
  }

  /**
   * Verifica la existencia del bloqueo en la empresa activa y comprueba los
   * permisos de edición/eliminación para el rol `profesional`.
   */
  private async asegurarBloqueoEditable(
    cliente: ClienteDb,
    sesion: ContextoSesion,
    id: string,
  ): Promise<FilaBloqueo> {
    if (!idSchema.safeParse(id).success) {
      throw AppException.noEncontrado('El bloqueo no existe');
    }

    const [existente] = await cliente
      .select()
      .from(bloqueos)
      .where(and(eq(bloqueos.id, id), eq(bloqueos.empresaId, sesion.empresa.id)))
      .limit(1);

    if (!existente) {
      throw AppException.noEncontrado('El bloqueo no existe');
    }

    if (sesion.rol === 'profesional') {
      if (existente.profesionalId === null) {
        throw AppException.sinPermiso(
          'Solo dueños o administradores pueden gestionar bloqueos de toda la empresa',
        );
      }
      await this.asegurarPermisoProfesional(cliente, sesion, existente.profesionalId);
    }

    return existente;
  }

  /**
   * Comprueba que `profesionalId` exista en la empresa (cuando no es `null`) y
   * que un usuario con rol `profesional` solo actúe sobre su propio perfil.
   */
  private async asegurarPermisoProfesional(
    cliente: ClienteDb,
    sesion: ContextoSesion,
    profesionalId: string | null,
  ): Promise<void> {
    if (profesionalId === null) {
      if (sesion.rol === 'profesional') {
        throw AppException.sinPermiso(
          'Solo dueños o administradores pueden gestionar bloqueos de toda la empresa',
        );
      }
      return;
    }

    const [profesional] = await cliente
      .select({ id: profesionales.id, usuarioId: profesionales.usuarioId })
      .from(profesionales)
      .where(
        and(eq(profesionales.id, profesionalId), eq(profesionales.empresaId, sesion.empresa.id)),
      )
      .limit(1);

    if (!profesional) {
      throw AppException.noEncontrado('El profesional no existe');
    }

    if (sesion.rol === 'profesional' && profesional.usuarioId !== sesion.usuario.id) {
      throw AppException.sinPermiso('Solo puedes gestionar tus propios bloqueos');
    }
  }

  /**
   * Cuenta las reservas activas (`estado !== 'cancelada'`) de la empresa cuyo
   * tramo ocupado `[fechaHoraInicio, bloqueoHasta)` se cruza con `[inicio, fin)`.
   */
  private async contarReservasAfectadas(
    cliente: ClienteDb,
    empresaId: string,
    profesionalId: string | null,
    inicio: Date,
    fin: Date,
  ): Promise<number> {
    const condiciones: SQL[] = [
      eq(reservas.empresaId, empresaId),
      ne(reservas.estado, 'cancelada'),
      lt(reservas.fechaHoraInicio, fin),
      gt(reservas.bloqueoHasta, inicio),
    ];

    if (profesionalId !== null) {
      condiciones.push(eq(reservas.profesionalId, profesionalId));
    }

    const [resultado] = await cliente
      .select({ total: count() })
      .from(reservas)
      .where(and(...condiciones));

    return Number(resultado?.total ?? 0);
  }

  private serializar(fila: FilaBloqueo): Bloqueo {
    return {
      id: fila.id,
      profesionalId: fila.profesionalId,
      inicio: fila.inicio.toISOString(),
      fin: fila.fin.toISOString(),
      motivo: fila.motivo,
      creadoEn: fila.creadoEn.toISOString(),
    };
  }
}
