import type { z } from 'zod';
import { RUTA_BASE_API, solicitar, type OpcionesPeticion, type Resultado } from './core';

/**
 * Cliente de la API para código que corre en el navegador (componentes
 * cliente, hooks de TanStack Query).
 *
 * Las rutas son relativas a `/api/v1`. El navegador habla siempre con el
 * mismo origen de la web; Next reenvía `/api/*` a la API (ver `next.config.ts`).
 * Por eso la cookie de sesión es de primera parte y no interviene CORS.
 *
 * Para componentes de servidor usa `apiServidor` de `lib/api/server.ts`.
 *
 * @example
 * // Lectura con TanStack Query
 * useQuery({
 *   queryKey: ['servicios'],
 *   queryFn: ({ signal }) => api.get('/servicios', { schema: paginaServiciosSchema, signal }),
 * });
 *
 * // Escritura
 * await api.post('/servicios', { cuerpo: datos, schema: servicioSchema });
 */
const contexto = { baseUrl: RUTA_BASE_API };

type SinCuerpo<T extends z.ZodType | undefined> = Omit<OpcionesPeticion<T>, 'cuerpo'>;

export const api = {
  get: <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    opciones?: SinCuerpo<T>,
  ): Promise<Resultado<T>> => solicitar(contexto, 'GET', ruta, opciones),

  post: <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    opciones?: OpcionesPeticion<T>,
  ): Promise<Resultado<T>> => solicitar(contexto, 'POST', ruta, opciones),

  put: <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    opciones?: OpcionesPeticion<T>,
  ): Promise<Resultado<T>> => solicitar(contexto, 'PUT', ruta, opciones),

  patch: <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    opciones?: OpcionesPeticion<T>,
  ): Promise<Resultado<T>> => solicitar(contexto, 'PATCH', ruta, opciones),

  delete: <T extends z.ZodType | undefined = undefined>(
    ruta: string,
    opciones?: SinCuerpo<T>,
  ): Promise<Resultado<T>> => solicitar(contexto, 'DELETE', ruta, opciones),
};
