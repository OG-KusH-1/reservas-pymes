import { NextResponse, type NextRequest } from 'next/server';
import { RUTAS } from './lib/rutas';

/**
 * Nombre de la cookie de sesión emitida por la API (`COOKIE_SESION` en
 * `apps/api/src/app.setup.ts`). Se define como constante local para no
 * acoplar `apps/web` con el código fuente de la API.
 */
export const COOKIE_SESION = 'agenda_sesion';

/**
 * Proxy de Next.js 16 para redirección temprana en rutas del panel (`/panel/**`).
 *
 * Comprueba de forma rápida si la petición entrante incluye la cookie de sesión.
 * Si falta, redirige a `/ingresar?siguiente=<rutaOriginal>` sin esperar a que
 * el layout del servidor consulte a la API.
 *
 * **Importante:** esto es solo una optimización de redirección temprana. Un
 * navegador puede enviar una cookie expirada, revocada o inventada; la
 * autoridad real sigue siendo la API al validar la sesión en el layout del
 * servidor (`PanelLayout`).
 */
export function proxy(request: NextRequest) {
  const tieneCookie = Boolean(request.cookies.get(COOKIE_SESION)?.value);

  if (!tieneCookie) {
    const urlIngreso = new URL(RUTAS.ingresar, request.url);
    const rutaOriginal = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    urlIngreso.searchParams.set('siguiente', rutaOriginal);
    return NextResponse.redirect(urlIngreso);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/panel', '/panel/:path*'],
};
