import { Hammer } from 'lucide-react';

/**
 * Marcador de una pantalla cuya ruta y layout ya existen pero cuyo contenido
 * se implementa en una tarea posterior del plan (`docs/PLAN.md`).
 *
 * Al implementar la pantalla, reemplaza este componente en la página; cuando
 * no quede ningún uso, elimina este archivo.
 */
export function EnConstruccion({ titulo, tarea }: { titulo: string; tarea: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <Hammer className="text-muted-foreground size-6" aria-hidden />
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Esta pantalla se implementa en la tarea {tarea} del plan.
      </p>
    </div>
  );
}
