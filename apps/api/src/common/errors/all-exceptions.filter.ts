import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { CodigoError, ErrorApi } from '@portfolio/contracts';
import type { Request, Response } from 'express';
import { AppException } from './app.exception.js';

/** Nombre de la restricción de PostgreSQL que impide reservas solapadas (ver migración antisolape). */
export const RESTRICCION_ANTISOLAPE = 'reservas_sin_solape';

/** Códigos SQLSTATE de PostgreSQL que se traducen a errores de negocio. */
const PG_VIOLACION_UNICIDAD = '23505';
const PG_VIOLACION_CLAVE_FORANEA = '23503';
const PG_VIOLACION_EXCLUSION = '23P01';
const PG_VIOLACION_CHECK = '23514';
/** Texto que no se puede convertir al tipo de la columna (por ejemplo, un UUID mal formado). */
const PG_FORMATO_INVALIDO = '22P02';

interface ErrorResuelto {
  estado: number;
  cuerpo: Omit<ErrorApi, 'traceId'>;
  /** `true` si es un fallo inesperado que debe registrarse con su traza completa. */
  inesperado: boolean;
}

/**
 * Filtro global: convierte cualquier excepción en la respuesta de error
 * estándar del contrato (`ErrorApi`).
 *
 * Reglas, en orden:
 *  1. `AppException`: se devuelve tal cual (errores de negocio previstos).
 *  2. `HttpException` de Nest (ruta inexistente, límite de peticiones, cuerpo
 *     mal formado…): se traduce el estado HTTP a un código del contrato.
 *  3. Errores de PostgreSQL por restricciones: se traducen a 409 (o a 400/404
 *     cuando el dato no cumple un CHECK o un formato). Esto cubre
 *     las condiciones de carrera que la validación previa no puede ver; por
 *     ejemplo, dos personas que reservan la misma hora a la vez: la segunda
 *     recibe `RESERVA_SOLAPADA` gracias a la restricción `EXCLUDE`.
 *  4. Cualquier otra cosa: 500 con mensaje genérico. El detalle real solo va
 *     al registro del servidor, nunca al cliente, para no filtrar información
 *     interna.
 *
 * Para dar un mensaje específico a una restricción nueva, captura el error en
 * el servicio y lanza una `AppException`; este filtro es la red de seguridad.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const peticion = http.getRequest<Request & { id?: string | number }>();
    const respuesta = http.getResponse<Response>();
    const traceId = peticion.id !== undefined ? String(peticion.id) : undefined;

    const { estado, cuerpo, inesperado } = this.resolver(excepcion);

    if (inesperado) {
      this.logger.error(
        {
          err: resumirParaRegistro(excepcion),
          traceId,
          metodo: peticion.method,
          ruta: peticion.path,
        },
        'Error no controlado',
      );
    }

    // Si la respuesta ya empezó a enviarse (por ejemplo, en una descarga) no
    // se puede cambiar el estado ni el cuerpo; solo queda cerrar la conexión.
    if (respuesta.headersSent) {
      respuesta.end();
      return;
    }

    respuesta.status(estado).json({ ...cuerpo, traceId } satisfies ErrorApi);
  }

  private resolver(excepcion: unknown): ErrorResuelto {
    if (excepcion instanceof AppException) {
      return {
        estado: excepcion.estado,
        cuerpo: {
          codigo: excepcion.codigo,
          mensaje: excepcion.message,
          detalles: excepcion.detalles,
        },
        inesperado: false,
      };
    }

    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      return {
        estado,
        cuerpo: { codigo: codigoPorEstado(estado), mensaje: mensajePorEstado(estado) },
        inesperado: estado >= 500,
      };
    }

    const errorPg = buscarErrorPostgres(excepcion);
    if (errorPg) {
      if (
        errorPg.code === PG_VIOLACION_EXCLUSION &&
        errorPg.constraint_name === RESTRICCION_ANTISOLAPE
      ) {
        return {
          estado: HttpStatus.CONFLICT,
          cuerpo: {
            codigo: 'RESERVA_SOLAPADA',
            mensaje: 'El horario seleccionado ya no está disponible',
          },
          inesperado: false,
        };
      }
      if (errorPg.code === PG_VIOLACION_UNICIDAD) {
        return {
          estado: HttpStatus.CONFLICT,
          cuerpo: { codigo: 'CONFLICTO', mensaje: 'Ya existe un registro con esos datos' },
          inesperado: false,
        };
      }
      if (errorPg.code === PG_VIOLACION_CHECK) {
        // Un dato pasó la validación de la API pero no una regla de la base
        // de datos. Se responde 400 y conviene sumar la regla al esquema Zod.
        return {
          estado: HttpStatus.BAD_REQUEST,
          cuerpo: { codigo: 'VALIDACION', mensaje: 'Los datos enviados no son válidos' },
          inesperado: false,
        };
      }
      if (errorPg.code === PG_FORMATO_INVALIDO) {
        // Caso típico: un identificador de la URL que no es un UUID y que no
        // se validó con `ZodPipe`. Para el cliente equivale a «no existe».
        return {
          estado: HttpStatus.NOT_FOUND,
          cuerpo: { codigo: 'NO_ENCONTRADO', mensaje: 'El recurso solicitado no existe' },
          inesperado: false,
        };
      }
      if (errorPg.code === PG_VIOLACION_CLAVE_FORANEA) {
        return {
          estado: HttpStatus.CONFLICT,
          cuerpo: {
            codigo: 'CONFLICTO',
            mensaje: 'La operación hace referencia a un registro inexistente o en uso',
          },
          inesperado: false,
        };
      }
    }

    return {
      estado: HttpStatus.INTERNAL_SERVER_ERROR,
      cuerpo: { codigo: 'INTERNO', mensaje: 'Ocurrió un error inesperado. Inténtalo nuevamente.' },
      inesperado: true,
    };
  }
}

function codigoPorEstado(estado: number): CodigoError {
  switch (estado) {
    case 400:
    case 413:
    case 415:
    case 422:
      return 'VALIDACION';
    case 401:
      return 'NO_AUTENTICADO';
    case 403:
      return 'SIN_PERMISO';
    case 404:
    case 405:
      return 'NO_ENCONTRADO';
    case 409:
      return 'CONFLICTO';
    case 429:
      return 'DEMASIADAS_SOLICITUDES';
    default:
      return estado >= 500 ? 'INTERNO' : 'VALIDACION';
  }
}

/**
 * Mensajes propios en español. No se reutiliza el mensaje de la excepción de
 * Nest porque viene en inglés y a veces incluye detalles internos.
 */
function mensajePorEstado(estado: number): string {
  switch (estado) {
    case 401:
      return 'Debes iniciar sesión';
    case 403:
      return 'No tienes permiso para realizar esta acción';
    case 404:
    case 405:
      return 'El recurso solicitado no existe';
    case 409:
      return 'La operación entra en conflicto con el estado actual';
    case 413:
      return 'El contenido enviado es demasiado grande';
    case 429:
      return 'Demasiadas solicitudes. Espera un momento e inténtalo nuevamente.';
    default:
      return estado >= 500
        ? 'Ocurrió un error inesperado. Inténtalo nuevamente.'
        : 'La solicitud no es válida';
  }
}

interface ErrorPostgres {
  code: string;
  constraint_name?: string;
  table_name?: string;
  column_name?: string;
}

/**
 * Reduce una excepción a lo que es seguro escribir en los registros.
 *
 * No se registra el error tal cual porque los errores de base de datos
 * incluyen datos de las personas: Drizzle pone en el mensaje la consulta con
 * sus parámetros, y PostgreSQL agrega en `detail` la fila completa que falló
 * (correos, hashes de contraseñas). De esos errores se guarda solo lo que
 * identifica el problema: código SQLSTATE, restricción, tabla y columna.
 *
 * Para el resto de los errores se conservan nombre, mensaje y traza.
 */
export function resumirParaRegistro(excepcion: unknown): Record<string, unknown> {
  const errorPg = buscarErrorPostgres(excepcion);
  if (errorPg) {
    return {
      tipo: 'PostgresError',
      codigo: errorPg.code,
      restriccion: errorPg.constraint_name,
      tabla: errorPg.table_name,
      columna: errorPg.column_name,
      // La traza señala qué servicio lanzó la consulta, sin incluir sus datos.
      traza: excepcion instanceof Error ? soloLineasDeTraza(excepcion.stack) : undefined,
    };
  }
  if (excepcion instanceof Error) {
    return { tipo: excepcion.name, mensaje: excepcion.message, traza: excepcion.stack };
  }
  return { tipo: typeof excepcion, mensaje: 'Se lanzó un valor que no es un Error' };
}

/** Quita de una traza el mensaje inicial y deja solo las líneas `at …`. */
function soloLineasDeTraza(traza?: string): string | undefined {
  return traza
    ?.split('\n')
    .filter((linea) => linea.trimStart().startsWith('at '))
    .join('\n');
}

/**
 * Busca un error de PostgreSQL en la excepción o en su cadena de `cause`.
 * Drizzle envuelve los errores del driver, por lo que el original suele estar
 * uno o dos niveles más abajo. El límite de profundidad evita ciclos.
 */
function buscarErrorPostgres(excepcion: unknown): ErrorPostgres | undefined {
  let actual: unknown = excepcion;
  for (let nivel = 0; nivel < 5 && actual instanceof Error; nivel++) {
    if (actual.name === 'PostgresError' && 'code' in actual && typeof actual.code === 'string') {
      return actual as unknown as ErrorPostgres;
    }
    actual = actual.cause;
  }
  return undefined;
}
