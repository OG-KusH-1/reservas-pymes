import {
  type CambiarContrasena,
  type RestablecerContrasena,
  type SolicitarRecuperacion,
  type VerificarCorreo,
} from '@portfolio/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { api } from '@/lib/api/client';

/**
 * Reenvía el correo de verificación a la cuenta autenticada (`POST /auth/verificar-correo/enviar`).
 */
export function useEnviarVerificacion() {
  return useMutation({
    mutationFn: () => api.post('/auth/verificar-correo/enviar'),
  });
}

/**
 * Confirma el correo electrónico mediante el token de verificación (`POST /publico/verificar-correo`).
 *
 * Invalida `CLAVE_SESION` al completarse con éxito para que el estado
 * `emailVerificado` se actualice si el usuario tenía una sesión abierta.
 */
export function useVerificarCorreo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: VerificarCorreo) =>
      api.post('/publico/verificar-correo', { cuerpo: datos }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_SESION });
    },
  });
}

/**
 * Solicita el envío de un correo de recuperación de contraseña (`POST /publico/recuperar`).
 *
 * La respuesta es siempre 204 sin revelar si el correo existe en la plataforma.
 */
export function useSolicitarRecuperacion() {
  return useMutation({
    mutationFn: (datos: SolicitarRecuperacion) => api.post('/publico/recuperar', { cuerpo: datos }),
  });
}

/**
 * Restablece la contraseña usando el token de recuperación (`POST /publico/restablecer`).
 */
export function useRestablecerContrasena() {
  return useMutation({
    mutationFn: (datos: RestablecerContrasena) =>
      api.post('/publico/restablecer', { cuerpo: datos }),
  });
}

/**
 * Cambia la contraseña de la cuenta autenticada (`POST /auth/cambiar-contrasena`).
 */
export function useCambiarContrasena() {
  return useMutation({
    mutationFn: (datos: CambiarContrasena) =>
      api.post('/auth/cambiar-contrasena', { cuerpo: datos }),
  });
}
