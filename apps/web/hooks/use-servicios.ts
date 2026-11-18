import {
  paginaServiciosSchema,
  servicioSchema,
  type ActualizarServicio,
  type CrearServicio,
  type PaginaServicios,
} from '@portfolio/contracts';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/** Clave raíz de caché para el catálogo de servicios de la empresa activa. */
export const CLAVE_SERVICIOS = ['servicios'] as const;

/** Filtros soportados al consultar el listado paginado de servicios. */
export interface FiltrosServicios {
  activo?: boolean;
  categoria?: string;
  q?: string;
  limite?: number;
}

/**
 * Construye la ruta con parámetros de consulta para `GET /servicios`,
 * omitiendo filtros vacíos para mantener estable la caché de TanStack Query.
 */
function construirRutaServicios(filtros: FiltrosServicios, cursor?: string): string {
  const params = new URLSearchParams();
  if (filtros.activo !== undefined) params.set('activo', String(filtros.activo));
  const categoria = filtros.categoria?.trim();
  if (categoria) params.set('categoria', categoria);
  const q = filtros.q?.trim();
  if (q) params.set('q', q);
  if (filtros.limite !== undefined) params.set('limite', String(filtros.limite));
  if (cursor) params.set('cursor', cursor);

  const query = params.toString();
  return query ? `/servicios?${query}` : '/servicios';
}

/**
 * Normaliza los filtros para que la clave de caché no cambie por espacios
 * en blanco o propiedades `undefined` equivalentes.
 */
function normalizarFiltros(filtros: FiltrosServicios): FiltrosServicios {
  return {
    ...(filtros.activo !== undefined ? { activo: filtros.activo } : {}),
    ...(filtros.categoria?.trim() ? { categoria: filtros.categoria.trim() } : {}),
    ...(filtros.q?.trim() ? { q: filtros.q.trim() } : {}),
    ...(filtros.limite !== undefined ? { limite: filtros.limite } : {}),
  };
}

/**
 * Consulta paginada por cursor del catálogo de servicios (`GET /servicios`).
 *
 * Usa `useInfiniteQuery` para cargar páginas adicionales con «Cargar más»
 * manteniendo filtros de estado, categoría y búsqueda por texto.
 */
export function useServicios(filtros: FiltrosServicios = {}) {
  const filtrosNormalizados = normalizarFiltros(filtros);

  return useInfiniteQuery<PaginaServicios>({
    queryKey: [...CLAVE_SERVICIOS, filtrosNormalizados] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get(
        construirRutaServicios(
          filtrosNormalizados,
          typeof pageParam === 'string' ? pageParam : undefined,
        ),
        { schema: paginaServiciosSchema, signal },
      ),
    getNextPageParam: (ultimaPagina) => ultimaPagina.siguienteCursor ?? undefined,
  });
}

/**
 * Crea un nuevo servicio en el catálogo de la empresa activa (`POST /servicios`).
 *
 * Invalida toda la rama `CLAVE_SERVICIOS` para refrescar cualquier filtro activo.
 */
export function useCrearServicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CrearServicio) =>
      api.post('/servicios', { cuerpo: datos, schema: servicioSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_SERVICIOS });
    },
  });
}

/**
 * Actualiza parcialmente un servicio existente (`PATCH /servicios/:id`).
 *
 * Invalida `CLAVE_SERVICIOS` al completar para reflejar cambios de nombre,
 * precio, duración, estado o categoría en el listado.
 */
export function useActualizarServicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarServicio }) =>
      api.patch(`/servicios/${encodeURIComponent(id)}`, {
        cuerpo: datos,
        schema: servicioSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_SERVICIOS });
    },
  });
}

/**
 * Elimina un servicio del catálogo (`DELETE /servicios/:id`).
 *
 * Puede fallar con `409 CONFLICTO` si el servicio tiene reservas asociadas;
 * el componente llamador debe mostrar ese mensaje sin cerrar el diálogo.
 */
export function useEliminarServicio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/servicios/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_SERVICIOS });
    },
  });
}
