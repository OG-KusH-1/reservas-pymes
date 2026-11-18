'use client';

import type { RolMiembro } from '@portfolio/contracts';
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  Menu,
  Settings,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Marca } from '@/components/layout/marca';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RUTAS } from '@/lib/rutas';
import { cn } from '@/lib/utils';

/** Definición declarativa de una sección del panel interno. */
export interface ItemNavegacion {
  href: string;
  etiqueta: string;
  descripcion: string;
  icono: LucideIcon;
  rolesPermitidos: readonly RolMiembro[];
}

/** Etiquetas legibles en español para cada rol de miembro. */
export const ETIQUETAS_ROL: Record<RolMiembro, string> = {
  dueno: 'Dueño',
  admin: 'Administrador',
  recepcion: 'Recepción',
  profesional: 'Profesional',
};

/**
 * Catálogo completo de secciones del panel y los roles que pueden acceder.
 *
 * Se mantiene en un único arreglo para que la barra lateral, el menú móvil y
 * los accesos rápidos del inicio compartan exactamente las mismas rutas y
 * reglas de visibilidad. `Clientes` excluye a `profesional` porque solo gestiona
 * su propia agenda; `Configuración` se limita a `dueno` y `admin` para no
 * exponer ajustes de empresa a recepción ni profesionales.
 */
export const ITEMS_NAVEGACION: readonly ItemNavegacion[] = [
  {
    href: RUTAS.panel.inicio,
    etiqueta: 'Inicio',
    descripcion: 'Resumen del negocio y accesos rápidos a tu trabajo diario.',
    icono: Home,
    rolesPermitidos: ['dueno', 'admin', 'recepcion', 'profesional'],
  },
  {
    href: RUTAS.panel.agenda,
    etiqueta: 'Agenda',
    descripcion: 'Calendario por día y semana con horarios y bloqueos.',
    icono: CalendarDays,
    rolesPermitidos: ['dueno', 'admin', 'recepcion', 'profesional'],
  },
  {
    href: RUTAS.panel.reservas,
    etiqueta: 'Reservas',
    descripcion: 'Listado de citas, estados, confirmaciones y reagendamientos.',
    icono: ClipboardList,
    rolesPermitidos: ['dueno', 'admin', 'recepcion', 'profesional'],
  },
  {
    href: RUTAS.panel.clientes,
    etiqueta: 'Clientes',
    descripcion: 'Fichas de contacto, historial de atención y notas internas.',
    icono: Users,
    rolesPermitidos: ['dueno', 'admin', 'recepcion'],
  },
  {
    href: RUTAS.panel.servicios,
    etiqueta: 'Servicios',
    descripcion: 'Catálogo de prestaciones, duraciones, precios y visibilidad.',
    icono: Briefcase,
    rolesPermitidos: ['dueno', 'admin', 'recepcion', 'profesional'],
  },
  {
    href: RUTAS.panel.equipo,
    etiqueta: 'Equipo',
    descripcion: 'Profesionales, miembros de la empresa e invitaciones.',
    icono: UserCheck,
    rolesPermitidos: ['dueno', 'admin', 'recepcion', 'profesional'],
  },
  {
    href: RUTAS.panel.configuracion,
    etiqueta: 'Configuración',
    descripcion: 'Perfil de la empresa, zona horaria y políticas de reserva.',
    icono: Settings,
    rolesPermitidos: ['dueno', 'admin'],
  },
];

/**
 * Filtra las secciones visibles del panel según el rol del usuario activo.
 *
 * Función pura pensada para reutilizarse tanto en la navegación como en la
 * página de inicio y probarse de forma aislada sin montar el layout completo.
 */
export function filtrarNavegacionPorRol(rol: RolMiembro): ItemNavegacion[] {
  return ITEMS_NAVEGACION.filter((item) => item.rolesPermitidos.includes(rol));
}

/** Determina si una ruta del panel corresponde a la ubicación actual. */
function esRutaActiva(pathname: string, href: string): boolean {
  if (href === RUTAS.panel.inicio) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barra lateral colapsable para escritorio (`md:` en adelante).
 *
 * Permite contraer la barra a solo iconos manteniendo tooltips accesibles y
 * `aria-current="page"` sobre la ruta activa.
 */
export function BarraLateralPanel({ rol }: { rol: RolMiembro }) {
  const pathname = usePathname();
  const [colapsada, setColapsada] = useState(false);
  const items = filtrarNavegacionPorRol(rol);

  return (
    <aside
      aria-label="Barra lateral"
      className={cn(
        'bg-card hidden shrink-0 border-r transition-[width] duration-200 md:flex md:flex-col',
        colapsada ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!colapsada && <Marca href={RUTAS.panel.inicio} />}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={!colapsada}
          aria-label={colapsada ? 'Expandir navegación lateral' : 'Contraer navegación lateral'}
          onClick={() => setColapsada((prev) => !prev)}
          className={cn(colapsada && 'mx-auto')}
        >
          {colapsada ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <ChevronLeft className="size-4" aria-hidden />
          )}
        </Button>
      </div>

      <nav aria-label="Navegación del panel" className="flex-1 p-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icono = item.icono;
            const activa = esRutaActiva(pathname, item.href);
            const enlace = (
              <Link
                href={item.href}
                aria-current={activa ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  colapsada && 'justify-center px-2',
                  activa
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icono className="size-4 shrink-0" aria-hidden />
                {colapsada ? <span className="sr-only">{item.etiqueta}</span> : item.etiqueta}
              </Link>
            );

            return (
              <li key={item.href}>
                {colapsada ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{enlace}</TooltipTrigger>
                    <TooltipContent side="right">{item.etiqueta}</TooltipContent>
                  </Tooltip>
                ) : (
                  enlace
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/**
 * Menú lateral deslizable (`Sheet`) para pantallas móviles (`< md`).
 *
 * Se cierra automáticamente al seleccionar cualquier destino para no obstruir
 * la vista tras la navegación.
 */
export function NavegacionMovil({ rol }: { rol: RolMiembro }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const items = filtrarNavegacionPorRol(rol);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="flex items-center">
            <Marca href={RUTAS.panel.inicio} />
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Navegación del panel" className="p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icono = item.icono;
              const activa = esRutaActiva(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={activa ? 'page' : undefined}
                    onClick={() => setAbierto(false)}
                    className={cn(
                      'focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      activa
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icono className="size-4 shrink-0" aria-hidden />
                    <span>{item.etiqueta}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
