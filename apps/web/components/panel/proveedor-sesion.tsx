'use client';

import type { Sesion } from '@portfolio/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect } from 'react';
import { CLAVE_SESION } from '@/hooks/use-sesion';

const SesionContext = createContext<Sesion | null>(null);

/**
 * Proveedor de sesión para componentes cliente dentro del panel (`/panel/**`).
 *
 * Recibe la sesión ya validada en el servidor por `PanelLayout` y la expone
 * de inmediato por contexto, además de hidratar la caché de TanStack Query
 * (`CLAVE_SESION`). Así los componentes cliente del panel disponen de usuario,
 * empresa y rol desde el primer renderizado sin parpadeos de carga ni
 * peticiones redundantes a `/auth/sesion`.
 *
 * Al modificarlo, conserva el sembrado de `CLAVE_SESION` para que `useSesion()`
 * y las mutaciones futuras (como el cambio de empresa activa) compartan el
 * mismo estado.
 */
export function ProveedorSesion({
  sesionInicial,
  children,
}: {
  sesionInicial: Sesion;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(CLAVE_SESION, sesionInicial);
  }, [queryClient, sesionInicial]);

  return <SesionContext.Provider value={sesionInicial}>{children}</SesionContext.Provider>;
}

/**
 * Devuelve la sesión activa garantizada dentro del panel.
 *
 * @throws {Error} Si se invoca fuera de `ProveedorSesion`.
 */
export function useSesionPanel(): Sesion {
  const sesion = useContext(SesionContext);
  if (!sesion) {
    throw new Error('useSesionPanel debe usarse dentro de ProveedorSesion');
  }
  return sesion;
}
