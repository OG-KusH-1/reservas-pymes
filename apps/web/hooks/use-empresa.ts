import { empresaSchema, type ActualizarEmpresa, type Empresa } from '@portfolio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAVE_SESION } from '@/hooks/use-sesion';
import { api } from '@/lib/api/client';

/** Clave única en TanStack Query para la configuración de la empresa activa. */
export const CLAVE_EMPRESA = ['empresa'] as const;

/**
 * Obtiene el perfil y las políticas de reserva de la empresa activa en la sesión
 * (`GET /empresa`).
 */
export function useEmpresa() {
  return useQuery<Empresa>({
    queryKey: CLAVE_EMPRESA,
    queryFn: ({ signal }) => api.get('/empresa', { schema: empresaSchema, signal }),
  });
}

/**
 * Actualiza parcialmente el perfil y/o las políticas de reserva de la empresa
 * activa (`PATCH /empresa`).
 *
 * Al completarse con éxito, actualiza inmediatamente la caché de `['empresa']`
 * e invalida `['sesion']` para refrescar nombre, slug, zona horaria y moneda
 * en la cabecera del panel.
 */
export function useActualizarEmpresa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ActualizarEmpresa) =>
      api.patch('/empresa', { cuerpo: datos, schema: empresaSchema }),
    onSuccess: (empresa) => {
      queryClient.setQueryData(CLAVE_EMPRESA, empresa);
      void queryClient.invalidateQueries({ queryKey: CLAVE_SESION });
    },
  });
}
