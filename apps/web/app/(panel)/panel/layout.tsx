import { sesionSchema, type Sesion } from '@portfolio/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MarcoPanel } from '@/components/panel/marco-panel';
import { ProveedorSesion } from '@/components/panel/proveedor-sesion';
import { ApiError, esApiError } from '@/lib/api/errores';
import { apiServidor } from '@/lib/api/server';
import { RUTAS } from '@/lib/rutas';

export const metadata: Metadata = {
  // El panel es privado: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

/**
 * Layout de servidor del panel interno (`/panel/**`).
 *
 * Valida la sesión contra la API antes de renderizar cualquier ruta hija: si
 * la API responde `NO_AUTENTICADO` (401), redirige de inmediato a `/ingresar`.
 * Luego hidrata `ProveedorSesion` con la sesión obtenida para evitar parpadeos
 * en los componentes cliente.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  let sesion: Sesion;

  try {
    sesion = await apiServidor.get('/auth/sesion', { schema: sesionSchema });
  } catch (error) {
    if (
      esApiError(error, 'NO_AUTENTICADO') ||
      (error instanceof ApiError && error.estado === 401)
    ) {
      redirect(RUTAS.ingresar);
    }
    throw error;
  }

  return (
    <ProveedorSesion sesionInicial={sesion}>
      <MarcoPanel>{children}</MarcoPanel>
    </ProveedorSesion>
  );
}
