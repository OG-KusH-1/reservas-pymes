import { Inject, Injectable } from '@nestjs/common';
import {
  idSchema,
  type ActualizarServicio,
  type ConsultaServicios,
  type CrearServicio,
  type PaginaServicios,
  type Servicio,
} from '@portfolio/contracts';
import { and, asc, eq, gt, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { AppException } from '../common/errors/app.exception.js';
import { codificarCursor, decodificarCursor, paginarResultados } from '../common/paginacion.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { reservas, servicios } from '../db/schema.js';

const PG_VIOLACION_CLAVE_FORANEA = '23503';
const MENSAJE_SERVICIO_CON_RESERVAS =
  'No se puede eliminar un servicio que tiene reservas; desactívalo en su lugar';

/** Esquema del cursor opaco de servicios, alineado con el orden `(nombre ASC, id ASC)`. */
const cursorServicioSchema = z.object({
  nombre: z.string(),
  id: z.uuid(),
});

/** Columnas públicas de `servicios` devueltas por la API. */
const columnasServicio = {
  id: servicios.id,
  nombre: servicios.nombre,
  descripcion: servicios.descripcion,
  categoria: servicios.categoria,
  duracionMinutos: servicios.duracionMinutos,
  margenPosteriorMinutos: servicios.margenPosteriorMinutos,
  precio: servicios.precio,
  visiblePublico: servicios.visiblePublico,
  color: servicios.color,
  activo: servicios.activo,
  creadoEn: servicios.creadoEn,
  actualizadoEn: servicios.actualizadoEn,
};

type FilaServicio = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  duracionMinutos: number;
  margenPosteriorMinutos: number;
  precio: number;
  visiblePublico: boolean;
  color: string | null;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
};

function mapearServicio(fila: FilaServicio): Servicio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    duracionMinutos: fila.duracionMinutos,
    margenPosteriorMinutos: fila.margenPosteriorMinutos,
    precio: fila.precio,
    visiblePublico: fila.visiblePublico,
    color: fila.color,
    activo: fila.activo,
    creadoEn: fila.creadoEn.toISOString(),
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

/** Escapa comodines de `LIKE`/`ILIKE` para que `%`, `_` y `\` se busquen de forma literal. */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/**
 * Recorre la cadena de `cause` de un error de Drizzle/PostgreSQL para detectar
 * una violación de clave foránea (`23503`).
 */
function esViolacionClaveForanea(excepcion: unknown): boolean {
  let actual: unknown = excepcion;
  for (let nivel = 0; nivel < 5 && actual instanceof Error; nivel++) {
    if ('code' in actual && actual.code === PG_VIOLACION_CLAVE_FORANEA) {
      return true;
    }
    actual = actual.cause;
  }
  return false;
}

/**
 * Servicio de gestión del catálogo de servicios de la empresa activa.
 *
 * Centraliza las invariantes del catálogo:
 * - Aislamiento multiempresa estricto: todas las consultas y mutaciones filtran
 *   por `empresaId` de la sesión (`NO_ENCONTRADO` ante recursos ajenos o IDs inválidos).
 * - Paginación determinista por cursor `(nombre ASC, id ASC)`.
 * - Unicidad de nombre insensible a mayúsculas únicamente entre servicios activos;
 *   los servicios inactivos pueden compartir nombre sin bloquear el catálogo.
 * - Protección ante eliminación cuando existen reservas asociadas (`409 CONFLICTO`).
 */
@Injectable()
export class ServiciosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Lista los servicios de la empresa activa con filtros opcionales y paginación
   * por cursor estable `(nombre ASC, id ASC)`.
   *
   * @throws AppException (`VALIDACION`) si el cursor recibido está mal formado.
   */
  async listar(empresaId: string, consulta: ConsultaServicios): Promise<PaginaServicios> {
    const condiciones: SQL[] = [eq(servicios.empresaId, empresaId)];

    if (consulta.activo !== undefined) {
      condiciones.push(eq(servicios.activo, consulta.activo));
    }

    if (consulta.categoria !== undefined) {
      condiciones.push(eq(servicios.categoria, consulta.categoria));
    }

    if (consulta.q !== undefined) {
      const patron = `%${escaparLike(consulta.q)}%`;
      const filtroBusqueda = or(
        ilike(servicios.nombre, patron),
        ilike(servicios.descripcion, patron),
        ilike(servicios.categoria, patron),
      );
      if (filtroBusqueda) {
        condiciones.push(filtroBusqueda);
      }
    }

    if (consulta.cursor !== undefined) {
      const cursor = decodificarCursor(consulta.cursor, cursorServicioSchema);
      const filtroCursor = or(
        gt(servicios.nombre, cursor.nombre),
        and(eq(servicios.nombre, cursor.nombre), gt(servicios.id, cursor.id)),
      );
      if (filtroCursor) {
        condiciones.push(filtroCursor);
      }
    }

    const filas = await this.db
      .select(columnasServicio)
      .from(servicios)
      .where(and(...condiciones))
      .orderBy(asc(servicios.nombre), asc(servicios.id))
      .limit(consulta.limite + 1);

    const elementos = filas.map(mapearServicio);
    return paginarResultados(elementos, consulta.limite, (ultimo) =>
      codificarCursor({ nombre: ultimo.nombre, id: ultimo.id }),
    );
  }

  /**
   * Obtiene un servicio puntual de la empresa activa por su identificador.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el identificador es inválido, no existe o pertenece a otra empresa.
   */
  async obtener(empresaId: string, id: string): Promise<Servicio> {
    if (!idSchema.safeParse(id).success) {
      throw AppException.noEncontrado('El servicio no existe');
    }

    const [servicio] = await this.db
      .select(columnasServicio)
      .from(servicios)
      .where(and(eq(servicios.empresaId, empresaId), eq(servicios.id, id)))
      .limit(1);

    if (!servicio) {
      throw AppException.noEncontrado('El servicio no existe');
    }

    return mapearServicio(servicio);
  }

  /**
   * Crea un nuevo servicio en el catálogo de la empresa activa.
   *
   * Si el servicio se crea activo (`activo !== false`), exige que no exista otro
   * servicio activo en la misma empresa con el mismo nombre (sin distinguir mayúsculas).
   *
   * @throws AppException (`CONFLICTO`) si ya existe un servicio activo con ese nombre.
   */
  async crear(empresaId: string, datos: CrearServicio): Promise<Servicio> {
    return this.db.transaction(async (tx) => {
      if (datos.activo !== false) {
        await this.asegurarNombreDisponibleEntreActivos(tx, empresaId, datos.nombre);
      }

      const [creado] = await tx
        .insert(servicios)
        .values({
          empresaId,
          nombre: datos.nombre,
          descripcion: datos.descripcion ?? null,
          categoria: datos.categoria ?? null,
          duracionMinutos: datos.duracionMinutos,
          margenPosteriorMinutos: datos.margenPosteriorMinutos,
          precio: datos.precio,
          visiblePublico: datos.visiblePublico,
          color: datos.color ?? null,
          activo: datos.activo,
        })
        .returning(columnasServicio);

      if (!creado) {
        throw AppException.noEncontrado('El servicio no existe');
      }

      return mapearServicio(creado);
    });
  }

  /**
   * Actualiza parcialmente un servicio de la empresa activa.
   *
   * Verifica la unicidad del nombre entre activos cuando el estado resultante
   * queda activo (`activo === true`) y cambia el nombre o se reactiva el servicio.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el servicio no existe en la empresa.
   * @throws AppException (`CONFLICTO`) si el resultado entra en conflicto con otro servicio activo de igual nombre.
   */
  async actualizar(empresaId: string, id: string, datos: ActualizarServicio): Promise<Servicio> {
    if (!idSchema.safeParse(id).success) {
      throw AppException.noEncontrado('El servicio no existe');
    }

    return this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select({
          id: servicios.id,
          nombre: servicios.nombre,
          activo: servicios.activo,
        })
        .from(servicios)
        .where(and(eq(servicios.empresaId, empresaId), eq(servicios.id, id)))
        .limit(1);

      if (!actual) {
        throw AppException.noEncontrado('El servicio no existe');
      }

      const nombreFinal = datos.nombre ?? actual.nombre;
      const activoFinal = datos.activo ?? actual.activo;
      const cambiaNombreOReactiva = datos.nombre !== undefined || (!actual.activo && activoFinal);

      if (activoFinal && cambiaNombreOReactiva) {
        await this.asegurarNombreDisponibleEntreActivos(tx, empresaId, nombreFinal, id);
      }

      const cambios: Partial<typeof servicios.$inferInsert> = {};
      if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
      if (datos.descripcion !== undefined) cambios.descripcion = datos.descripcion;
      if (datos.categoria !== undefined) cambios.categoria = datos.categoria;
      if (datos.duracionMinutos !== undefined) cambios.duracionMinutos = datos.duracionMinutos;
      if (datos.margenPosteriorMinutos !== undefined) {
        cambios.margenPosteriorMinutos = datos.margenPosteriorMinutos;
      }
      if (datos.precio !== undefined) cambios.precio = datos.precio;
      if (datos.visiblePublico !== undefined) cambios.visiblePublico = datos.visiblePublico;
      if (datos.color !== undefined) cambios.color = datos.color;
      if (datos.activo !== undefined) cambios.activo = datos.activo;

      const [actualizado] = await tx
        .update(servicios)
        .set(cambios)
        .where(and(eq(servicios.empresaId, empresaId), eq(servicios.id, id)))
        .returning(columnasServicio);

      if (!actualizado) {
        throw AppException.noEncontrado('El servicio no existe');
      }

      return mapearServicio(actualizado);
    });
  }

  /**
   * Elimina un servicio de la empresa activa si no tiene reservas asociadas.
   *
   * Comprueba previamente la existencia de reservas y mantiene la captura de
   * error `23503` (clave foránea) para cubrir condiciones de carrera con la
   * creación concurrente de una reserva.
   *
   * @throws AppException (`NO_ENCONTRADO`) si el servicio no existe en la empresa.
   * @throws AppException (`CONFLICTO`) si existen reservas asociadas al servicio.
   */
  async eliminar(empresaId: string, id: string): Promise<void> {
    if (!idSchema.safeParse(id).success) {
      throw AppException.noEncontrado('El servicio no existe');
    }

    await this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ id: servicios.id })
        .from(servicios)
        .where(and(eq(servicios.empresaId, empresaId), eq(servicios.id, id)))
        .limit(1);

      if (!actual) {
        throw AppException.noEncontrado('El servicio no existe');
      }

      const [reservaAsociada] = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(and(eq(reservas.empresaId, empresaId), eq(reservas.servicioId, id)))
        .limit(1);

      if (reservaAsociada) {
        throw AppException.conflicto(MENSAJE_SERVICIO_CON_RESERVAS);
      }

      try {
        await tx
          .delete(servicios)
          .where(and(eq(servicios.empresaId, empresaId), eq(servicios.id, id)));
      } catch (error) {
        if (esViolacionClaveForanea(error)) {
          throw AppException.conflicto(MENSAJE_SERVICIO_CON_RESERVAS);
        }
        throw error;
      }
    });
  }

  /**
   * Verifica dentro de la transacción que no exista otro servicio activo con el
   * mismo nombre en la empresa.
   */
  private async asegurarNombreDisponibleEntreActivos(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    empresaId: string,
    nombre: string,
    excluirId?: string,
  ): Promise<void> {
    const condiciones: SQL[] = [
      eq(servicios.empresaId, empresaId),
      eq(servicios.activo, true),
      sql`lower(${servicios.nombre}) = lower(${nombre})`,
    ];

    if (excluirId !== undefined) {
      condiciones.push(ne(servicios.id, excluirId));
    }

    const [duplicado] = await tx
      .select({ id: servicios.id })
      .from(servicios)
      .where(and(...condiciones))
      .limit(1);

    if (duplicado) {
      throw AppException.conflicto('Ya existe un servicio activo con ese nombre');
    }
  }
}
