import { CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RUTAS } from '@/lib/rutas';

/** Logotipo de la plataforma. Enlaza al inicio salvo que se indique otra ruta. */
export function Marca({ href = RUTAS.inicio, className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}
    >
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
        <CalendarCheck className="size-4" aria-hidden />
      </span>
      <span className="text-base">Agenda</span>
    </Link>
  );
}
