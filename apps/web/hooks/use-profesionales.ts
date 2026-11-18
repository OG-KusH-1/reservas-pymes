import {
  paginaProfesionalesSchema,
  paginaServiciosSchema,
  profesionalSchema,
  type ActualizarProfesional,
  type AsignarServiciosProfesional,
  type CrearProfesional,
  type PaginaProfesionales,
  type Profesional,
  type Servicio,
  type VincularUsuarioProfesional,
} from '@portfolio/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/** Clave raíz de caché para todas las consultas de profesionales. */
export const CLAVE_PROFESIONALES = ['profesionales'] as const;

/** Clave de caché para los servicios disponibles en selectores de profesionales. */
export const CLAVE_SERVICIOS_PARA_PROFESIONALES = [
  'profesionales',
  'servicios-disponibles',
] as const;

/** Filtros soportados por el listado paginado de profesionales. */
export interface FiltrosProfesionales {
  activo?: boolean;
  servicioId?: string;
  q?: string;
  limite?: number;
}

/**
 * Construye la clave de caché para una combinación específica de filtros del
 * listado de profesionales.
 */
export function claveListaProfesionales(filtros: FiltrosProfesionales) {
  return [...CLAVE_PROFESIONALES, 'lista', filtros] as const;
}

/**
 * Arma la URL de `GET /profesionales` omitiendo los parámetros indefinidos o
 * vacíos para que la clave de petición y la consulta coincidan con el contrato.
 */
function construirRutaProfesionales(filtros: FiltrosProfesionales, cursor?: string): string {
  const params = new URLSearchParams();
  if (filtros.activo !== undefined) params.set('activo', String(filtros.activo));
  if (filtros.servicioId) params.set('servicioId', filtros.servicioId);
  const texto = filtros.q?.trim();
  if (texto) params.set('q', texto);
  if (filtros.limite !== undefined) params.set('limite', String(filtros.limite));
  if (cursor) params.set('cursor', cursor);

  const query = params.toString();
  return query ? `/profesionales?${query}` : '/profesionales';
}

/**
 * Consulta paginada por cursor de los profesionales de la empresa activa
 * (`GET /profesionales`).
 *
 * Usa `useInfiniteQuery` para soportar carga incremental mediante el botón
 * «Cargar más» manteniendo los filtros activos (`activo`, `servicioId`, `q`).
 */
export function useProfesionales(filtros: FiltrosProfesionales = {}) {
  return useInfiniteQuery<
    PaginaProfesionales,
    Error,
    InfiniteData<PaginaProfesionales>,
    ReturnType<typeof claveListaProfesionales>,
    string | undefined
  >({
    queryKey: claveListaProfesionales(filtros),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      api.get(construirRutaProfesionales(filtros, pageParam), {
        schema: paginaProfesionalesSchema,
        signal,
      }),
    getNextPageParam: (ultimaPagina) => ultimaPagina.siguienteCursor ?? undefined,
  });
}

/**
 * Lista los servicios de la empresa para el filtro y el diálogo de asignación
 * (`GET /servicios?limite=100`).
 *
 * Se consulta directamente con `api.get` y `paginaServiciosSchema` para mantener
 * el módulo desacoplado del hook de servicios.
 */
export function useServiciosParaProfesionales() {
  return useQuery<Servicio[]>({
    queryKey: CLAVE_SERVICIOS_PARA_PROFESIONALES,
    queryFn: async ({ signal }) => {
      const pagina = await api.get('/servicios?limite=100', {
        schema: paginaServiciosSchema,
        signal,
      });
      return pagina.datos;
    },
  });
}

/**
 * Registra un nuevo profesional en la empresa activa (`POST /profesionales`).
 *
 * Al completarse invalida `CLAVE_PROFESIONALES` para refrescar todas las páginas
 * y filtros activos.
 */
export function useCrearProfesional() {
  const queryClient = useQueryClient();

  return useMutation<Profesional, Error, CrearProfesional>({
    mutationFn: (datos) => api.post('/profesionales', { cuerpo: datos, schema: profesionalSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PROFESIONALES });
    },
  });
}

/**
 * Actualiza parcialmente los datos o el estado activo de un profesional
 * (`PATCH /profesionales/:id`).
 *
 * Invalida `CLAVE_PROFESIONALES` tras el éxito para reflejar los cambios en el
 * listado independientemente de los filtros aplicados.
 */
export function useActualizarProfesional() {
  const queryClient = useQueryClient();

  return useMutation<Profesional, Error, { id: string; datos: ActualizarProfesional }>({
    mutationFn: ({ id, datos }) =>
      api.patch(`/profesionales/${encodeURIComponent(id)}`, {
        cuerpo: datos,
        schema: profesionalSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PROFESIONALES });
    },
  });
}

/**
 * Elimina un profesional de la empresa activa (`DELETE /profesionales/:id`).
 *
 * Puede fallar con `409 CONFLICTO` si el profesional tiene reservas asociadas.
 */
export function useEliminarProfesional() {
  const queryClient = useQueryClient();

  return useMutation<undefined, Error, string>({
    mutationFn: (id) => api.delete(`/profesionales/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PROFESIONALES });
    },
  });
}

/**
 * Reemplaza atómicamente los servicios que atiende un profesional
 * (`PUT /profesionales/:id/servicios`).
 *
 * Una lista vacía desasigna todos sus servicios. Invalida `CLAVE_PROFESIONALES`
 * al completarse.
 */
export function useAsignarServiciosProfesional() {
  const queryClient = useQueryClient();

  return useMutation<Profesional, Error, { id: string; datos: AsignarServiciosProfesional }>({
    mutationFn: ({ id, datos }) =>
      api.put(`/profesionales/${encodeURIComponent(id)}/servicios`, {
        cuerpo: datos,
        schema: profesionalSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PROFESIONALES });
    },
  });
}

/**
 * Vincula o desvincula un profesional con una cuenta miembro del equipo
 * (`PUT /profesionales/:id/usuario`).
 *
 * Si el `usuarioId` ya está asociado a otro profesional de la misma empresa, la
 * API responde `409 CONFLICTO`.
 */
export function useVincularUsuarioProfesional() {
  const queryClient = useQueryClient();

  return useMutation<Profesional, Error, { id: string; datos: VincularUsuarioProfesional }>({
    mutationFn: ({ id, datos }) =>
      api.put(`/profesionales/${encodeURIComponent(id)}/usuario`, {
        cuerpo: datos,
        schema: profesionalSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PROFESIONALES });
    },
  });
}
