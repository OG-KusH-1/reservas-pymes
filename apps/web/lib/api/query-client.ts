import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errores';

/** Máximo de reintentos automáticos de una lectura fallida. */
const REINTENTOS_MAXIMOS = 2;

/**
 * Crea el `QueryClient` con los valores por defecto de la aplicación.
 *
 * - `staleTime` de 30 s: al navegar entre pantallas no se repite una petición
 *   recién hecha. Las pantallas que necesiten datos al instante (la agenda del
 *   día) deben bajar este valor en su propio `useQuery`.
 * - Reintentos solo ante fallos transitorios (sin conexión o errores 5xx).
 *   Un 4xx (sin permiso, no encontrado, validación) fallará igual al
 *   reintentar, así que se informa de inmediato.
 * - Las mutaciones nunca se reintentan solas: repetir una escritura podría
 *   duplicar una reserva.
 */
export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (intentos, error) => {
          if (error instanceof ApiError && error.estado >= 400 && error.estado < 500) return false;
          return intentos < REINTENTOS_MAXIMOS;
        },
      },
      mutations: { retry: false },
    },
  });
}
