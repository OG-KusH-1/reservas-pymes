/**
 * Rutas de la aplicación en un solo lugar. Usa estas constantes en enlaces y
 * redirecciones en vez de escribir la ruta a mano: así un cambio de URL se
 * hace una sola vez y TypeScript encuentra todos los usos.
 *
 * Estructura de `app/` (los grupos entre paréntesis no aparecen en la URL):
 *  - `(marketing)`  sitio público de la plataforma: inicio.
 *  - `(auth)`       ingreso, registro y recuperación de cuenta.
 *  - `(panel)`      panel interno de cada empresa; requiere sesión.
 *  - `(publico)`    página de reservas de una empresa: `/{slug}`.
 *
 * Toda ruta de primer nivel nueva debe agregarse también a
 * `SLUGS_RESERVADOS` en `@portfolio/contracts`, para que ninguna empresa
 * pueda registrar un slug que la tape.
 */
export const RUTAS = {
  inicio: '/',
  estado: '/estado',
  ingresar: '/ingresar',
  registro: '/registro',
  recuperar: '/recuperar',
  restablecer: '/restablecer',
  verificar: '/verificar',
  invitacion: '/invitacion',
  panel: {
    inicio: '/panel',
    agenda: '/panel/agenda',
    reservas: '/panel/reservas',
    clientes: '/panel/clientes',
    servicios: '/panel/servicios',
    equipo: '/panel/equipo',
    configuracion: '/panel/configuracion',
  },
  /** Página pública de reservas de una empresa. */
  empresa: (slug: string) => `/${slug}`,
} as const;
