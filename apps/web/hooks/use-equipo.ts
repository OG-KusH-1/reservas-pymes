import {
  detalleInvitacionPublicaSchema,
  empresaDeUsuarioSchema,
  invitacionSchema,
  miembroSchema,
  sesionSchema,
  type AceptarInvitacion,
  type ActualizarMiembro,
  type CambiarEmpresaActiva,
  type CrearInvitacion,
  type DetalleInvitacionPublica,
  type EmpresaDeUsuario,
  type Invitacion,
  type Miembro,
} from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { api } from '@/lib/api/client';

/** Clave de caché para el listado de miembros de la empresa activa. */
export const CLAVE_MIEMBROS = ['miembros'] as const;

/** Clave de caché para las invitaciones pendientes de la empresa activa. */
export const CLAVE_INVITACIONES = ['invitaciones'] as const;

/** Clave de caché para las empresas a las que pertenece el usuario autenticado. */
export const CLAVE_EMPRESAS_USUARIO = ['empresas-usuario'] as const;

/** Clave de caché para consultar el detalle público de una invitación por token. */
export function claveDetalleInvitacion(token: string) {
  return ['invitacion', token] as const;
}

const listaMiembrosSchema = z.array(miembroSchema);
const listaInvitacionesSchema = z.array(invitacionSchema);
const listaEmpresasSchema = z.array(empresaDeUsuarioSchema);

/**
 * Obtiene los miembros de la empresa activa (`GET /miembros`).
 *
 * Incluye los datos públicos del usuario (nombre, correo, verificación) junto con
 * su rol y estado activo dentro de la empresa.
 */
export function useMiembros() {
  return useQuery<Miembro[]>({
    queryKey: CLAVE_MIEMBROS,
    queryFn: ({ signal }) => api.get('/miembros', { schema: listaMiembrosSchema, signal }),
  });
}

/**
 * Actualiza el rol o el estado activo de un miembro (`PATCH /miembros/:id`).
 *
 * Al completarse con éxito invalida `CLAVE_MIEMBROS` para reflejar los cambios
 * en la tabla del equipo.
 */
export function useActualizarMiembro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarMiembro }) =>
      api.patch(`/miembros/${encodeURIComponent(id)}`, {
        cuerpo: datos,
        schema: miembroSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_MIEMBROS });
    },
  });
}

/**
 * Elimina un miembro de la empresa activa (`DELETE /miembros/:id`).
 *
 * Al completarse con éxito invalida `CLAVE_MIEMBROS`.
 */
export function useEliminarMiembro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/miembros/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_MIEMBROS });
    },
  });
}

/**
 * Lista las invitaciones pendientes de la empresa activa (`GET /invitaciones`).
 *
 * Permite deshabilitar la consulta mediante `enabled` cuando el rol activo no
 * tiene permisos de administración (`dueno` o `admin`).
 */
export function useInvitaciones(opciones?: { enabled?: boolean }) {
  return useQuery<Invitacion[]>({
    queryKey: CLAVE_INVITACIONES,
    queryFn: ({ signal }) => api.get('/invitaciones', { schema: listaInvitacionesSchema, signal }),
    enabled: opciones?.enabled ?? true,
  });
}

/**
 * Crea y envía una nueva invitación por correo (`POST /invitaciones`).
 *
 * Invalida `CLAVE_INVITACIONES` para mostrar inmediatamente la invitación
 * pendiente en el listado.
 */
export function useCrearInvitacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CrearInvitacion) =>
      api.post('/invitaciones', { cuerpo: datos, schema: invitacionSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_INVITACIONES });
    },
  });
}

/**
 * Revoca una invitación pendiente (`DELETE /invitaciones/:id`).
 *
 * Invalida `CLAVE_INVITACIONES` tras la revocación.
 */
export function useRevocarInvitacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/invitaciones/${encodeURIComponent(id)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_INVITACIONES });
    },
  });
}

/**
 * Consulta el detalle público de una invitación por token (`GET /publico/invitaciones/:token`).
 *
 * Expone si el correo invitado ya tiene cuenta (`usuarioExiste`) para decidir si
 * se solicita registro (nombre y contraseña) o inicio de sesión previo.
 */
export function useDetalleInvitacion(token: string) {
  return useQuery<DetalleInvitacionPublica>({
    queryKey: claveDetalleInvitacion(token),
    queryFn: ({ signal }) =>
      api.get(`/publico/invitaciones/${encodeURIComponent(token)}`, {
        schema: detalleInvitacionPublicaSchema,
        signal,
      }),
    enabled: Boolean(token.trim()),
    retry: false,
  });
}

/**
 * Acepta una invitación (`POST /publico/invitaciones/:token/aceptar`).
 *
 * La API inicia o actualiza la cookie de sesión y devuelve la nueva `Sesion`,
 * que se guarda en `CLAVE_SESION` y refresca el listado de empresas del usuario.
 */
export function useAceptarInvitacion(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: AceptarInvitacion) =>
      api.post(`/publico/invitaciones/${encodeURIComponent(token)}/aceptar`, {
        cuerpo: datos,
        schema: sesionSchema,
      }),
    onSuccess: (sesion) => {
      queryClient.setQueryData(CLAVE_SESION, sesion);
      void queryClient.invalidateQueries({ queryKey: CLAVE_EMPRESAS_USUARIO });
    },
  });
}

/**
 * Lista todas las empresas a las que pertenece el usuario autenticado (`GET /auth/empresas`).
 *
 * Se usa en el menú de usuario para permitir el cambio de empresa activa cuando
 * el usuario participa en más de un negocio.
 */
export function useEmpresasUsuario() {
  return useQuery<EmpresaDeUsuario[]>({
    queryKey: CLAVE_EMPRESAS_USUARIO,
    queryFn: ({ signal }) => api.get('/auth/empresas', { schema: listaEmpresasSchema, signal }),
  });
}

/**
 * Cambia la empresa activa de la sesión (`POST /auth/empresa-activa`).
 *
 * Actualiza `CLAVE_SESION` con la sesión devuelta e invalida todas las demás
 * consultas del panel para evitar mostrar datos de la empresa anterior.
 */
export function useCambiarEmpresaActiva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CambiarEmpresaActiva) =>
      api.post('/auth/empresa-activa', { cuerpo: datos, schema: sesionSchema }),
    onSuccess: (sesion) => {
      queryClient.setQueryData(CLAVE_SESION, sesion);
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== CLAVE_SESION[0],
      });
    },
  });
}
