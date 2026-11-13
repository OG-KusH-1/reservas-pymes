import { useQuery } from '@tanstack/react-query';
import { saludSchema } from '@portfolio/contracts';
import { api } from '@/lib/api/client';

/**
 * Estado de la API y de sus dependencias, actualizado cada 15 segundos.
 *
 * Sirve además de plantilla para los hooks de datos del proyecto:
 *  - un hook por recurso, en `hooks/`;
 *  - `queryKey` como arreglo que empieza por el nombre del recurso, para poder
 *    invalidarlo tras una mutación (`queryClient.invalidateQueries({ queryKey: ['salud'] })`);
 *  - el esquema de `@portfolio/contracts` valida y tipa la respuesta;
 *  - se pasa `signal` para que la petición se cancele si el componente se desmonta.
 */
export function useSalud() {
  return useQuery({
    queryKey: ['salud'],
    queryFn: ({ signal }) => api.get('/health', { schema: saludSchema, signal }),
    refetchInterval: 15_000,
    // Un chequeo de estado debe reflejar la realidad de inmediato: sin reintentos ni caché.
    retry: false,
    staleTime: 0,
  });
}
