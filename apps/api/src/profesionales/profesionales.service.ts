import { Inject, Injectable } from '@nestjs/common';
import {
  idSchema,
  type ActualizarProfesional,
  type AsignarServiciosProfesional,
  type ConsultaProfesionales,
  type CrearProfesional,
  type PaginaProfesionales,
  type Profesional,
  type ServicioDeProfesional,
  type VincularUsuarioProfesional,
} from '@portfolio/contracts';
import { and, asc, eq, exists, gt, ilike, inArray, ne, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { AppException } from '../common/errors/app.exception.js';
import { codificarCursor, decodificarCursor, paginarResultados } from '../common/paginacion.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import {
  miembros,
  profesionales,
  profesionalesServicios,
  reservas,
  servicios,
} from '../db/schema.js';

type ClienteDb = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
type FilaProfesional = typeof profesionales.$inferSelect;

const PG_VIOLACION_CLAVE_FORANEA = '23503';

const cursorProfesionalSchema = z.object({
  nombre: z.string(),
  id: idSchema,
});

/**
 * Escapa los comodines de `LIKE`/`ILIKE` (`\`, `%`, `_`) para que una búsqueda
 * textual no los interprete como patrones.
 */
function escaparLike(texto: string): string {
  return texto.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

/**
 * Detecta si un error de Drizzle envuelve un código SQLSTATE específico de
 * PostgreSQL en su cadena de `cause`.
 */
function esErrorPostgres(error: unknown, codigo: string): boolean {
  let actual: unknown = error;
  for (let nivel = 0; nivel < 5 && actual instanceof Error; nivel++) {
    if (actual.name === 'PostgresError' && 'code' in actual && actual.code === codigo) {
      return true;
    }
    actual = actual.cause;
  }
  return false;
}

/**
 * Servicio de gestión de profesionales de la empresa activa.
 *
 * Centraliza las reglas de negocio del equipo que atiende:
 * - Aislamiento estricto por `empresaId` de la sesión (`NO_ENCONTRADO` ante
 *   recursos ajenos o identificadores malformados).
 * - Paginación estable por `(nombre ASC, id ASC)` con carga por lote de
 *   servicios para evitar consultas N+1.
 * - Asignación atómica de servicios verificando pertenencia a la empresa.
 * - Vínculo opcional con una cuenta miembro (a lo sumo un profesional por
 *   usuario dentro de la misma empresa).
 * - Protección contra eliminación si el profesional tiene reservas asociadas.
 */
@Injectable()
export class ProfesionalesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Lista los profesionales de la empresa activa con filtros opcionales
   * (`activo`, `servicioId`, `q`) y paginación por cursor.
   *
   * @throws AppException (`VALIDACION`) si el cursor de paginación es inválido.
   */
  async listar(empresaId: string, consulta: ConsultaProfesionales): Promise<PaginaProfesionales> {
    const condiciones: (SQL | undefined)[] = [eq(profesionales.empresaId, empresaId)];

    if (consulta.cursor !== undefined) {
      const cursor = decodificarCursor(consulta.cursor, cursorProfesionalSchema);
      condiciones.push(
        or(
          gt(profesionales.nombre, cursor.nombre),
          and(eq(profesionales.nombre, cursor.nombre), gt(profesionales.id, cursor.id)),
        ),
      );
    }

    if (consulta.activo !== undefined) {
      condiciones.push(eq(profesionales.activo, consulta.activo));
    }

    if (consulta.q !== undefined) {
      const patron = `%${escaparLike(consulta.q)}%`;
      condiciones.push(or(ilike(profesionales.nombre, patron), ilike(profesionales.email, patron)));
    }

    if (consulta.servicioId !== undefined) {
      // `exists` evita duplicar filas o alterar `limit(limite + 1)` frente a joins.
      condiciones.push(
        exists(
          this.db
            .select({ profesionalId: profesionalesServicios.profesionalId })
            .from(profesionalesServicios)
            .where(
              and(
                eq(profesionalesServicios.empresaId, empresaId),
                eq(profesionalesServicios.profesionalId, profesionales.id),
                eq(profesionalesServicios.servicioId, consulta.servicioId),
              ),
            ),
        ),
      );
    }

    const filas = await this.db
      .select()
      .from(profesionales)
      .where(and(...condiciones))
      .orderBy(asc(profesionales.nombre), asc(profesionales.id))
      .limit(consulta.limite + 1);

    const pagina = paginarResultados(filas, consulta.limite, (ultimo) =>
      codificarCursor({ nombre: ultimo.nombre, id: ultimo.id }),
    );

    const serviciosPorProfesional = await this.cargarServiciosPorProfesional(
      this.db,
      empresaId,
      pagina.datos.map((fila) => fila.id),
    );

    return {
      datos: pagina.datos.map((fila) =>
        this.serializar(fila, serviciosPorProfesional.get(fila.id) ?? []),
      ),
      siguienteCursor: pagina.siguienteCursor,
    };
  }

  /**
   * Obtiene un profesional de la empresa activa junto con sus servicios asignados.
   *
   * @throws AppException (`NO_ENCONTRADO`) si no existe o pertenece a otra empresa.
   */
  async obtener(empresaId: string, id: string): Promise<Profesional> {
    this.validarId(id);

    const [fila] = await this.db
      .select()
      .from(profesionales)
      .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)))
      .limit(1);

    if (!fila) {
      throw AppException.noEncontrado('El profesional no existe');
    }

    const mapa = await this.cargarServiciosPorProfesional(this.db, empresaId, [fila.id]);
    return this.serializar(fila, mapa.get(fila.id) ?? []);
  }

  /**
   * Registra un nuevo profesional en la empresa activa.
   */
  async crear(empresaId: string, datos: CrearProfesional): Promise<Profesional> {
    const [creado] = await this.db
      .insert(profesionales)
      .values({
        empresaId,
        nombre: datos.nombre,
        email: datos.email ?? null,
        telefono: datos.telefono ?? null,
        activo: datos.activo,
      })
      .returning();

    if (!creado) {
      throw AppException.noEncontrado('No se pudo crear el profesional');
    }

    return this.serializar(creado, []);
  }

  /**
   * Actualiza parcialmente los datos básicos de un profesional de la empresa activa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si no existe o pertenece a otra empresa.
   */
  async actualizar(
    empresaId: string,
    id: string,
    datos: ActualizarProfesional,
  ): Promise<Profesional> {
    this.validarId(id);

    const cambios: Partial<typeof profesionales.$inferInsert> = {};
    if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
    if (datos.email !== undefined) cambios.email = datos.email;
    if (datos.telefono !== undefined) cambios.telefono = datos.telefono;
    if (datos.activo !== undefined) cambios.activo = datos.activo;

    const [actualizado] = await this.db
      .update(profesionales)
      .set(cambios)
      .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)))
      .returning();

    if (!actualizado) {
      throw AppException.noEncontrado('El profesional no existe');
    }

    const mapa = await this.cargarServiciosPorProfesional(this.db, empresaId, [actualizado.id]);
    return this.serializar(actualizado, mapa.get(actualizado.id) ?? []);
  }

  /**
   * Elimina un profesional de la empresa activa si no tiene reservas asociadas.
   *
   * @throws AppException (`NO_ENCONTRADO`) si no existe o pertenece a otra empresa.
   * @throws AppException (`CONFLICTO`) si tiene reservas registradas.
   */
  async eliminar(empresaId: string, id: string): Promise<void> {
    this.validarId(id);

    await this.db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: profesionales.id })
        .from(profesionales)
        .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)))
        .limit(1);

      if (!existente) {
        throw AppException.noEncontrado('El profesional no existe');
      }

      const [conReservas] = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(and(eq(reservas.empresaId, empresaId), eq(reservas.profesionalId, id)))
        .limit(1);

      if (conReservas) {
        throw AppException.conflicto(
          'No se puede eliminar un profesional que tiene reservas; desactívalo en su lugar',
        );
      }

      try {
        await tx
          .delete(profesionales)
          .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)));
      } catch (error) {
        if (esErrorPostgres(error, PG_VIOLACION_CLAVE_FORANEA)) {
          throw AppException.conflicto(
            'No se puede eliminar un profesional que tiene reservas; desactívalo en su lugar',
          );
        }
        throw error;
      }
    });
  }

  /**
   * Reemplaza de forma atómica los servicios que atiende un profesional.
   *
   * Si alguno de los servicios no existe en la empresa activa, revierte la
   * transacción y responde `404 NO_ENCONTRADO` sin alterar la asignación previa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el profesional o algún servicio no pertenece a la empresa.
   */
  async asignarServicios(
    empresaId: string,
    id: string,
    datos: AsignarServiciosProfesional,
  ): Promise<Profesional> {
    this.validarId(id);

    const servicioIdsUnicos = [...new Set(datos.servicioIds)];

    return this.db.transaction(async (tx) => {
      const [profesional] = await tx
        .select()
        .from(profesionales)
        .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)))
        .limit(1);

      if (!profesional) {
        throw AppException.noEncontrado('El profesional no existe');
      }

      if (servicioIdsUnicos.length > 0) {
        const encontrados = await tx
          .select({ id: servicios.id })
          .from(servicios)
          .where(and(eq(servicios.empresaId, empresaId), inArray(servicios.id, servicioIdsUnicos)));

        if (encontrados.length !== servicioIdsUnicos.length) {
          throw AppException.noEncontrado('Alguno de los servicios indicados no existe');
        }
      }

      await tx
        .delete(profesionalesServicios)
        .where(
          and(
            eq(profesionalesServicios.empresaId, empresaId),
            eq(profesionalesServicios.profesionalId, id),
          ),
        );

      if (servicioIdsUnicos.length > 0) {
        await tx.insert(profesionalesServicios).values(
          servicioIdsUnicos.map((servicioId) => ({
            empresaId,
            profesionalId: id,
            servicioId,
          })),
        );
      }

      const mapa = await this.cargarServiciosPorProfesional(tx, empresaId, [profesional.id]);
      return this.serializar(profesional, mapa.get(profesional.id) ?? []);
    });
  }

  /**
   * Vincula o desvincula un profesional con una cuenta miembro de la empresa activa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el profesional o la membresía no existen en la empresa.
   * @throws AppException (`CONFLICTO`) si el usuario ya está vinculado a otro profesional de la empresa.
   */
  async vincularUsuario(
    empresaId: string,
    id: string,
    datos: VincularUsuarioProfesional,
  ): Promise<Profesional> {
    this.validarId(id);

    return this.db.transaction(async (tx) => {
      const [profesional] = await tx
        .select({ id: profesionales.id })
        .from(profesionales)
        .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)))
        .limit(1);

      if (!profesional) {
        throw AppException.noEncontrado('El profesional no existe');
      }

      if (datos.usuarioId !== null) {
        const [membresia] = await tx
          .select({ id: miembros.id })
          .from(miembros)
          .where(and(eq(miembros.empresaId, empresaId), eq(miembros.usuarioId, datos.usuarioId)))
          .limit(1);

        if (!membresia) {
          throw AppException.noEncontrado('El usuario no es miembro de la empresa');
        }

        const [otroProfesional] = await tx
          .select({ id: profesionales.id })
          .from(profesionales)
          .where(
            and(
              eq(profesionales.empresaId, empresaId),
              eq(profesionales.usuarioId, datos.usuarioId),
              ne(profesionales.id, id),
            ),
          )
          .limit(1);

        if (otroProfesional) {
          throw AppException.conflicto('Ese usuario ya está vinculado a otro profesional');
        }
      }

      const [actualizado] = await tx
        .update(profesionales)
        .set({ usuarioId: datos.usuarioId })
        .where(and(eq(profesionales.id, id), eq(profesionales.empresaId, empresaId)))
        .returning();

      if (!actualizado) {
        throw AppException.noEncontrado('El profesional no existe');
      }

      const mapa = await this.cargarServiciosPorProfesional(tx, empresaId, [actualizado.id]);
      return this.serializar(actualizado, mapa.get(actualizado.id) ?? []);
    });
  }

  private validarId(id: string): void {
    if (!idSchema.safeParse(id).success) {
      throw AppException.noEncontrado('El profesional no existe');
    }
  }

  /**
   * Carga en una sola consulta los servicios asignados a un lote de
   * profesionales de la empresa activa, ordenados por nombre del servicio.
   */
  private async cargarServiciosPorProfesional(
    cliente: ClienteDb,
    empresaId: string,
    profesionalIds: readonly string[],
  ): Promise<Map<string, ServicioDeProfesional[]>> {
    const mapa = new Map<string, ServicioDeProfesional[]>();
    if (profesionalIds.length === 0) {
      return mapa;
    }

    const filas = await cliente
      .select({
        profesionalId: profesionalesServicios.profesionalId,
        id: servicios.id,
        nombre: servicios.nombre,
        color: servicios.color,
        activo: servicios.activo,
      })
      .from(profesionalesServicios)
      .innerJoin(
        servicios,
        and(
          eq(profesionalesServicios.servicioId, servicios.id),
          eq(servicios.empresaId, empresaId),
        ),
      )
      .where(
        and(
          eq(profesionalesServicios.empresaId, empresaId),
          inArray(profesionalesServicios.profesionalId, [...profesionalIds]),
        ),
      )
      .orderBy(asc(servicios.nombre));

    for (const fila of filas) {
      const lista = mapa.get(fila.profesionalId) ?? [];
      lista.push({
        id: fila.id,
        nombre: fila.nombre,
        color: fila.color,
        activo: fila.activo,
      });
      mapa.set(fila.profesionalId, lista);
    }

    return mapa;
  }

  private serializar(fila: FilaProfesional, listaServicios: ServicioDeProfesional[]): Profesional {
    return {
      id: fila.id,
      usuarioId: fila.usuarioId,
      nombre: fila.nombre,
      email: fila.email,
      telefono: fila.telefono,
      activo: fila.activo,
      servicios: listaServicios,
      creadoEn: fila.creadoEn.toISOString(),
      actualizadoEn: fila.actualizadoEn.toISOString(),
    };
  }
}
