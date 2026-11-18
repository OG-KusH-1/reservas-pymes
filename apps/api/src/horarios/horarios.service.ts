import { Inject, Injectable } from '@nestjs/common';
import {
  idSchema,
  type ReemplazarHorarios,
  type TramoHorario,
  type TramoHorarioEntrada,
} from '@portfolio/contracts';
import { and, asc, eq } from 'drizzle-orm';
import type { ContextoSesion } from '../auth/auth.decorators.js';
import { AppException } from '../common/errors/app.exception.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { horarios, profesionales } from '../db/schema.js';

type ClienteDb = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
type FilaHorario = typeof horarios.$inferSelect;

/**
 * Servicio de gestión de horarios semanales por profesional.
 *
 * Centraliza las reglas de disponibilidad base semanal:
 * - Aislamiento multiempresa estricto (`NO_ENCONTRADO` si el profesional no
 *   pertenece a `empresaId` o si su identificador no es un UUID válido).
 * - Un miembro con rol `profesional` solo puede modificar los horarios del
 *   registro de profesional vinculado a su propia cuenta (`SIN_PERMISO`).
 * - Reemplazo atómico en transacción de toda la semana, validando que cada
 *   tramo tenga `horaInicio < horaFin` y que los tramos de un mismo día no se
 *   solapen (se permiten tramos contiguos).
 */
@Injectable()
export class HorariosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Lista todos los tramos horarios semanales de un profesional de la empresa
   * activa, ordenados por `diaSemana` y `horaInicio` ascendentes.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el profesional no existe en la empresa.
   */
  async listar(empresaId: string, profesionalId: string): Promise<TramoHorario[]> {
    await this.asegurarProfesional(this.db, empresaId, profesionalId);

    const filas = await this.db
      .select()
      .from(horarios)
      .where(and(eq(horarios.empresaId, empresaId), eq(horarios.profesionalId, profesionalId)))
      .orderBy(asc(horarios.diaSemana), asc(horarios.horaInicio));

    return filas.map((fila) => this.serializar(fila));
  }

  /**
   * Reemplaza de forma atómica toda la semana de horarios de un profesional.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el profesional no existe en la empresa.
   * @throws AppException (`SIN_PERMISO`) si un `profesional` intenta editar horarios ajenos.
   * @throws AppException (`VALIDACION`) si algún tramo tiene rango inválido o se solapa con otro del mismo día.
   */
  async reemplazar(
    sesion: ContextoSesion,
    profesionalId: string,
    datos: ReemplazarHorarios,
  ): Promise<TramoHorario[]> {
    this.validarTramos(datos.tramos);

    return this.db.transaction(async (tx) => {
      const profesional = await this.asegurarProfesional(tx, sesion.empresa.id, profesionalId);

      if (sesion.rol === 'profesional' && profesional.usuarioId !== sesion.usuario.id) {
        throw AppException.sinPermiso('Solo puedes gestionar tus propios horarios');
      }

      await tx
        .delete(horarios)
        .where(
          and(eq(horarios.empresaId, sesion.empresa.id), eq(horarios.profesionalId, profesionalId)),
        );

      if (datos.tramos.length === 0) {
        return [];
      }

      const insertados = await tx
        .insert(horarios)
        .values(
          datos.tramos.map((tramo) => ({
            empresaId: sesion.empresa.id,
            profesionalId,
            diaSemana: tramo.diaSemana,
            horaInicio: tramo.horaInicio,
            horaFin: tramo.horaFin,
            activo: tramo.activo,
          })),
        )
        .returning();

      insertados.sort((a, b) => {
        if (a.diaSemana !== b.diaSemana) {
          return a.diaSemana - b.diaSemana;
        }
        return a.horaInicio.localeCompare(b.horaInicio);
      });

      return insertados.map((fila) => this.serializar(fila));
    });
  }

  /**
   * Verifica que el `profesionalId` sea un UUID válido y pertenezca a la
   * empresa activa; de lo contrario responde `404 NO_ENCONTRADO`.
   */
  private async asegurarProfesional(
    cliente: ClienteDb,
    empresaId: string,
    profesionalId: string,
  ): Promise<{ id: string; usuarioId: string | null }> {
    if (!idSchema.safeParse(profesionalId).success) {
      throw AppException.noEncontrado('El profesional no existe');
    }

    const [profesional] = await cliente
      .select({ id: profesionales.id, usuarioId: profesionales.usuarioId })
      .from(profesionales)
      .where(and(eq(profesionales.id, profesionalId), eq(profesionales.empresaId, empresaId)))
      .limit(1);

    if (!profesional) {
      throw AppException.noEncontrado('El profesional no existe');
    }

    return profesional;
  }

  /**
   * Valida en el servicio que cada tramo cumpla `horaInicio < horaFin` y que
   * los tramos de un mismo `diaSemana` no se solapen como intervalos
   * semiabiertos `[horaInicio, horaFin)`.
   */
  private validarTramos(tramos: readonly TramoHorarioEntrada[]): void {
    const porDia = new Map<
      number,
      Array<{ indice: number; horaInicio: string; horaFin: string }>
    >();

    tramos.forEach((tramo, indice) => {
      if (tramo.horaInicio >= tramo.horaFin) {
        throw AppException.validacion([
          {
            campo: `tramos.${indice}.horaFin`,
            mensaje: 'La hora de inicio debe ser anterior a la hora de fin',
          },
        ]);
      }

      const lista = porDia.get(tramo.diaSemana) ?? [];
      lista.push({ indice, horaInicio: tramo.horaInicio, horaFin: tramo.horaFin });
      porDia.set(tramo.diaSemana, lista);
    });

    for (const tramosDia of porDia.values()) {
      const ordenados = [...tramosDia].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
      for (let i = 1; i < ordenados.length; i++) {
        const anterior = ordenados[i - 1]!;
        const actual = ordenados[i]!;
        if (actual.horaInicio < anterior.horaFin && anterior.horaInicio < actual.horaFin) {
          throw AppException.validacion([
            {
              campo: `tramos.${actual.indice}.horaInicio`,
              mensaje: 'Los tramos de un mismo día no pueden solaparse',
            },
          ]);
        }
      }
    }
  }

  /**
   * Serializa una fila de `horarios` al contrato público. PostgreSQL devuelve
   * las columnas `time` como `HH:mm:ss`, por lo que se recortan a `HH:mm`.
   */
  private serializar(fila: FilaHorario): TramoHorario {
    return {
      id: fila.id,
      profesionalId: fila.profesionalId,
      diaSemana: fila.diaSemana,
      horaInicio: fila.horaInicio.slice(0, 5),
      horaFin: fila.horaFin.slice(0, 5),
      activo: fila.activo,
      creadoEn: fila.creadoEn.toISOString(),
    };
  }
}
