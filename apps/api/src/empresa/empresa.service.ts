import { Inject, Injectable } from '@nestjs/common';
import type { ActualizarEmpresa, Empresa } from '@portfolio/contracts';
import { and, eq, ne } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { empresas } from '../db/schema.js';

/** Columnas públicas de `empresas` devueltas por la API. */
const columnasEmpresa = {
  id: empresas.id,
  nombre: empresas.nombre,
  slug: empresas.slug,
  rut: empresas.rut,
  email: empresas.email,
  telefono: empresas.telefono,
  direccion: empresas.direccion,
  zonaHoraria: empresas.zonaHoraria,
  moneda: empresas.moneda,
  anticipacionMinimaMinutos: empresas.anticipacionMinimaMinutos,
  anticipacionMaximaDias: empresas.anticipacionMaximaDias,
  cancelacionMinimaMinutos: empresas.cancelacionMinimaMinutos,
  intervaloGrillaMinutos: empresas.intervaloGrillaMinutos,
  confirmacionAutomatica: empresas.confirmacionAutomatica,
  recordatorioHorasAntes: empresas.recordatorioHorasAntes,
  creadoEn: empresas.creadoEn,
  actualizadoEn: empresas.actualizadoEn,
};

type FilaEmpresa = {
  id: string;
  nombre: string;
  slug: string;
  rut: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  zonaHoraria: string;
  moneda: string;
  anticipacionMinimaMinutos: number;
  anticipacionMaximaDias: number;
  cancelacionMinimaMinutos: number;
  intervaloGrillaMinutos: number;
  confirmacionAutomatica: boolean;
  recordatorioHorasAntes: number;
  creadoEn: Date;
  actualizadoEn: Date;
};

function mapearEmpresa(fila: FilaEmpresa): Empresa {
  return {
    id: fila.id,
    nombre: fila.nombre,
    slug: fila.slug,
    rut: fila.rut,
    email: fila.email,
    telefono: fila.telefono,
    direccion: fila.direccion,
    zonaHoraria: fila.zonaHoraria,
    moneda: fila.moneda,
    anticipacionMinimaMinutos: fila.anticipacionMinimaMinutos,
    anticipacionMaximaDias: fila.anticipacionMaximaDias,
    cancelacionMinimaMinutos: fila.cancelacionMinimaMinutos,
    intervaloGrillaMinutos: fila.intervaloGrillaMinutos,
    confirmacionAutomatica: fila.confirmacionAutomatica,
    recordatorioHorasAntes: fila.recordatorioHorasAntes,
    creadoEn: fila.creadoEn.toISOString(),
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}

/**
 * Servicio de consulta y actualización de la empresa activa y sus políticas
 * de reserva.
 *
 * Opera siempre sobre el `empresaId` proveniente de la sesión autenticada
 * para garantizar el aislamiento multiempresa.
 */
@Injectable()
export class EmpresaService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Obtiene el perfil completo y las políticas de reserva de la empresa activa.
   *
   * @throws AppException (`NO_ENCONTRADO`) si la empresa no existe en la base de datos.
   */
  async obtener(empresaId: string): Promise<Empresa> {
    const [empresa] = await this.db
      .select(columnasEmpresa)
      .from(empresas)
      .where(eq(empresas.id, empresaId))
      .limit(1);

    if (!empresa) {
      throw AppException.noEncontrado('Empresa no encontrada');
    }

    return mapearEmpresa(empresa);
  }

  /**
   * Actualiza parcialmente el perfil y/o las políticas de reserva de la empresa
   * activa dentro de una transacción.
   *
   * Verifica la unicidad del `slug` únicamente cuando cambia respecto al valor
   * actual (excluyendo la propia empresa), de modo que reenviar el mismo `slug`
   * junto con otros campos no produzca un falso conflicto.
   *
   * @throws AppException (`NO_ENCONTRADO`) si la empresa no existe.
   * @throws AppException (`CONFLICTO`) si el nuevo `slug` ya pertenece a otra empresa.
   */
  async actualizar(empresaId: string, datos: ActualizarEmpresa): Promise<Empresa> {
    return this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ id: empresas.id, slug: empresas.slug })
        .from(empresas)
        .where(eq(empresas.id, empresaId))
        .limit(1);

      if (!actual) {
        throw AppException.noEncontrado('Empresa no encontrada');
      }

      if (datos.slug !== undefined && datos.slug !== actual.slug) {
        const [duplicada] = await tx
          .select({ id: empresas.id })
          .from(empresas)
          .where(and(eq(empresas.slug, datos.slug), ne(empresas.id, empresaId)))
          .limit(1);

        if (duplicada) {
          throw AppException.conflicto('Ese identificador público ya está en uso');
        }
      }

      const cambios: Partial<typeof empresas.$inferInsert> = {};
      if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
      if (datos.slug !== undefined) cambios.slug = datos.slug;
      if (datos.rut !== undefined) cambios.rut = datos.rut;
      if (datos.email !== undefined) cambios.email = datos.email;
      if (datos.telefono !== undefined) cambios.telefono = datos.telefono;
      if (datos.direccion !== undefined) cambios.direccion = datos.direccion;
      if (datos.zonaHoraria !== undefined) cambios.zonaHoraria = datos.zonaHoraria;
      if (datos.moneda !== undefined) cambios.moneda = datos.moneda;
      if (datos.anticipacionMinimaMinutos !== undefined) {
        cambios.anticipacionMinimaMinutos = datos.anticipacionMinimaMinutos;
      }
      if (datos.anticipacionMaximaDias !== undefined) {
        cambios.anticipacionMaximaDias = datos.anticipacionMaximaDias;
      }
      if (datos.cancelacionMinimaMinutos !== undefined) {
        cambios.cancelacionMinimaMinutos = datos.cancelacionMinimaMinutos;
      }
      if (datos.intervaloGrillaMinutos !== undefined) {
        cambios.intervaloGrillaMinutos = datos.intervaloGrillaMinutos;
      }
      if (datos.confirmacionAutomatica !== undefined) {
        cambios.confirmacionAutomatica = datos.confirmacionAutomatica;
      }
      if (datos.recordatorioHorasAntes !== undefined) {
        cambios.recordatorioHorasAntes = datos.recordatorioHorasAntes;
      }

      const [actualizada] = await tx
        .update(empresas)
        .set(cambios)
        .where(eq(empresas.id, empresaId))
        .returning(columnasEmpresa);

      if (!actualizada) {
        throw AppException.noEncontrado('Empresa no encontrada');
      }

      return mapearEmpresa(actualizada);
    });
  }
}
