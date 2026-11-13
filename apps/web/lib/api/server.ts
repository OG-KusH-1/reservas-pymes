import 'server-only';
import { cookies, headers } from 'next/headers';
import type { z } from 'zod';
import { RUTA_BASE_API, solicitar, type OpcionesPeticion, type Resultado } from './core';

/**
 * Cliente de la API para código que corre en el servidor de Next (componentes
 * de servidor, `generateMetadata`, acciones de servidor).
 *
 * Diferencias con el cliente del navegador:
 *  - Llama a la API por su dirección interna (`API_URL`), sin pasar por los
 *    rewrites.
 *  - Reenvía la cookie de la petición entrante, de modo que la API ve la
 *    misma sesión que el navegador.
 *  - No guarda nada en caché (`no-store`): los datos del panel dependen de la
 *    sesión y no deben compartirse entre usuarios. Para páginas públicas que
 *    sí convenga cachear (ficha de una empresa), pasa `revalidarSegundos`.
 *
 * `server-only` hace fallar la compilación si este archivo se importa desde
 * un componente cliente.
 *
 * @example
 * const empresa = await apiServidor.get(`/publico/empresas/${slug}`, {
 *   schema: empresaPublicaSchema,
 *   revalidarSegundos: 60,
 * });
 */
const URL_API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

interface OpcionesServidor {
  /** Segundos que Next puede reutilizar la respuesta. Solo para datos públicos. */
  revalidarSegundos?: number;
}

/** Tiempo máximo de espera de una llamada a la API desde el servidor. */
const TIEMPO_MAXIMO_MS = 10_000;

async function contextoServidor(opciones: OpcionesServidor) {
  const publico = opciones.revalidarSegundos !== undefined;
  // Sin límite, una API colgada dejaría la página esperando varios minutos.
  const signal = AbortSignal.timeout(TIEMPO_MAXIMO_MS);

  if (publico) {
    // Una respuesta cacheable no puede depender de quién la pide: no se envía
    // la cookie ni la IP del visitante.
    return {
      baseUrl: `${URL_API}${RUTA_BASE_API}`,
      init: { next: { revalidate: opciones.revalidarSegundos }, signal } satisfies RequestInit,
    };
  }

  const [galletas, cabecerasEntrantes] = await Promise.all([cookies(), headers()]);
  const cabeceras: Record<string, string> = { cookie: galletas.toString() };
  // Se reenvía la IP del visitante para que el límite de peticiones de la API
  // cuente por persona y no por el servidor de la web. La API solo la acepta
  // de los proxies de confianza (`TRUST_PROXY`).
  const ipVisitante = cabecerasEntrantes.get('x-forwarded-for');
  if (ipVisitante) cabeceras['x-forwarded-for'] = ipVisitante;

  return {
    baseUrl: `${URL_API}${RUTA_BASE_API}`,
    cabeceras,
    init: { cache: 'no-store', signal } satisfies RequestInit,
  };
}

export const apiServidor = {
  get: async <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    { revalidarSegundos, ...opciones }: Omit<OpcionesPeticion<T>, 'cuerpo'> & OpcionesServidor = {},
  ): Promise<Resultado<T>> =>
    solicitar(await contextoServidor({ revalidarSegundos }), 'GET', ruta, opciones),

  post: async <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    opciones: OpcionesPeticion<T> = {},
  ): Promise<Resultado<T>> => solicitar(await contextoServidor({}), 'POST', ruta, opciones),
};
