import { Loader2 } from 'lucide-react';

/**
 * Indicador de carga del panel mientras una pantalla obtiene sus datos en el servidor.
 *
 * Está en el panel y no en la raíz de `app/` a propósito: un `loading.tsx`
 * hace que Next empiece a enviar la respuesta (con estado 200) antes de que la
 * página termine. En la página pública `/{slug}` eso impediría responder 404
 * cuando la empresa no existe, lo que perjudica el SEO. En el panel, que es
 * privado, no tiene ese costo.
 */
export default function Cargando() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center" role="status">
      <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
