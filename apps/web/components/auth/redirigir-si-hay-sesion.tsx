'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSesion } from '@/hooks/use-sesion';
import { RUTAS } from '@/lib/rutas';

/**
 * Redirige al panel cuando la persona ya tiene una sesión activa.
 *
 * Se ejecuta en el cliente usando `useSesion` para evitar que alguien
 * autenticado permanezca en `/ingresar` o `/registro`; la protección definitiva
 * de rutas en el servidor se agrega en T14.
 */
export function RedirigirSiHaySesion() {
  const router = useRouter();
  const { data: sesion } = useSesion();

  useEffect(() => {
    if (sesion) {
      router.replace(RUTAS.panel.inicio);
    }
  }, [sesion, router]);

  return null;
}
