import { errorApiSchema } from '@portfolio/contracts';
import type { z } from 'zod';
import { ApiError } from './errores';

/** Ruta base de la API vista desde el navegador (mismo origen, vía rewrites de Next). */
export const RUTA_BASE_API = '/api/v1';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Valores admitidos en la cadena de consulta. `undefined` y `null` se omiten. */
export type ParametrosConsulta = Record<string, string | number | boolean | null | undefined>;

export interface OpcionesPeticion<T extends z.ZodType | undefined = undefined> {
  /**
   * Esquema Zod de la respuesta (de `@portfolio/contracts`). La respuesta se
   * valida contra él y el resultado queda tipado. Si se omite, se ignora el
   * cuerpo de la respuesta y la promesa resuelve `undefined`.
   */
  schema?: T;
  /** Cuerpo de la petición; se envía como JSON. */
  cuerpo?: unknown;
  consulta?: ParametrosConsulta;
  /** Permite cancelar la petición (TanStack Query entrega esta señal en `queryFn`). */
  signal?: AbortSignal;
}

/** Tipo del resultado según se haya pasado o no un esquema. */
export type Resultado<T extends z.ZodType | undefined> = T extends z.ZodType
  ? z.output<T>
  : undefined;

export interface ContextoPeticion {
  /** Origen y prefijo de la API, sin barra final. */
  baseUrl: string;
  /** Cabeceras adicionales (en el servidor, la cookie de la petición entrante). */
  cabeceras?: Record<string, string>;
  /** Opciones extra de `fetch` (por ejemplo, la política de caché de Next). */
  init?: RequestInit;
}

function construirUrl(baseUrl: string, ruta: string, consulta?: ParametrosConsulta): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null) parametros.set(clave, String(valor));
  }
  const cadena = parametros.toString();
  return `${baseUrl}${ruta}${cadena ? `?${cadena}` : ''}`;
}

/**
 * Núcleo compartido por el cliente del navegador (`client.ts`) y el del
 * servidor (`server.ts`). No lo uses directamente desde componentes.
 *
 * Garantías para quien llama:
 *  - Si resuelve, el dato cumple el esquema indicado.
 *  - Si falla, siempre lanza `ApiError`, con un mensaje en español listo para
 *    mostrar, sin importar la causa (error de negocio, red caída, respuesta
 *    con forma inesperada).
 *
 * La única excepción es la cancelación (`AbortError`), que se propaga tal cual
 * porque TanStack Query la usa para descartar peticiones obsoletas en silencio.
 */
export async function solicitar<T extends z.ZodType | undefined = undefined>(
  contexto: ContextoPeticion,
  metodo: MetodoHttp,
  ruta: string,
  opciones: OpcionesPeticion<T> = {},
): Promise<Resultado<T>> {
  const tieneCuerpo = opciones.cuerpo !== undefined;
  let respuesta: Response;

  try {
    respuesta = await fetch(construirUrl(contexto.baseUrl, ruta, opciones.consulta), {
      ...contexto.init,
      method: metodo,
      // Envía la cookie de sesión `httpOnly`; el navegador la gestiona solo.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(tieneCuerpo ? { 'Content-Type': 'application/json' } : {}),
        ...contexto.cabeceras,
      },
      body: tieneCuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      // La señal de quien llama tiene prioridad sobre la del contexto.
      signal: opciones.signal ?? contexto.init?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      codigo: 'INTERNO',
      mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.',
    });
  }

  if (!respuesta.ok) {
    const cuerpo = errorApiSchema.safeParse(await respuesta.json().catch(() => null));
    throw new ApiError(
      respuesta.status,
      cuerpo.success
        ? cuerpo.data
        : // La respuesta no vino de nuestra API (por ejemplo, un proxy caído).
          { codigo: 'INTERNO', mensaje: 'El servidor no está disponible. Inténtalo más tarde.' },
    );
  }

  if (!opciones.schema) return undefined as Resultado<T>;

  const datos = opciones.schema.safeParse(await respuesta.json().catch(() => null));
  if (!datos.success) {
    // Indica que la API y la web están desincronizadas respecto del contrato:
    // es un defecto de programación, no algo que la persona pueda corregir.
    console.error(`Respuesta fuera de contrato en ${metodo} ${ruta}`, datos.error.issues);
    throw new ApiError(respuesta.status, {
      codigo: 'INTERNO',
      mensaje: 'Recibimos una respuesta inesperada del servidor.',
    });
  }
  return datos.data as Resultado<T>;
}
