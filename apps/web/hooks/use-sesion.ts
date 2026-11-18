import { sesionSchema, type IniciarSesion, type Registro, type Sesion } from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ApiError, esApiError } from '@/lib/api/errores';

/** Clave única en TanStack Query para la sesión activa. */
export const CLAVE_SESION = ['sesion'] as const;

/**
 * Obtiene la sesión actual del usuario autenticado (`GET /auth/sesion`).
 *
 * Un estado `401` (`NO_AUTENTICADO`) representa ausencia de sesión y no un fallo
 * de red o del servidor, por lo que devuelve `null` en lugar de lanzar error y
 * desactiva los reintentos para no retrasar la detección de usuario anónimo.
 */
export function useSesion() {
  return useQuery<Sesion | null>({
    queryKey: CLAVE_SESION,
    queryFn: async ({ signal }) => {
      try {
        return await api.get('/auth/sesion', { schema: sesionSchema, signal });
      } catch (error) {
        if (
          esApiError(error, 'NO_AUTENTICADO') ||
          (error instanceof ApiError && error.estado === 401)
        ) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });
}

/**
 * Inicia sesión con correo y contraseña (`POST /auth/ingresar`).
 *
 * La API emite la cookie `httpOnly` de sesión; al completarse con éxito,
 * guarda la sesión devuelta en la caché de `['sesion']` para evitar una
 * consulta adicional al entrar al panel.
 */
export function useIniciarSesion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: IniciarSesion) =>
      api.post('/auth/ingresar', { cuerpo: datos, schema: sesionSchema }),
    onSuccess: (sesion) => {
      queryClient.setQueryData(CLAVE_SESION, sesion);
    },
  });
}

/**
 * Registra una nueva empresa junto con la cuenta de su dueño (`POST /auth/registro`).
 *
 * Al completarse con éxito, almacena la sesión creada en la caché de `['sesion']`
 * de modo que la transición al panel sea inmediata.
 */
export function useRegistro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: Registro) =>
      api.post('/auth/registro', { cuerpo: datos, schema: sesionSchema }),
    onSuccess: (sesion) => {
      queryClient.setQueryData(CLAVE_SESION, sesion);
    },
  });
}

/**
 * Cierra la sesión activa en el servidor (`POST /auth/salir`).
 *
 * Vacía **toda** la caché de TanStack Query al tener éxito para garantizar que
 * ningún dato de la empresa anterior permanezca visible si otra persona inicia
 * sesión en el mismo navegador.
 */
export function useCerrarSesion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post('/auth/salir'),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
