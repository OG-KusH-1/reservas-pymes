'use client';

import { Building2, Check, ChevronDown, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SelectorTema } from '@/components/layout/selector-tema';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCambiarEmpresaActiva, useEmpresasUsuario } from '@/hooks/use-equipo';
import { useCerrarSesion } from '@/hooks/use-sesion';
import { mensajeDeError } from '@/lib/api/errores';
import { RUTAS } from '@/lib/rutas';
import { ETIQUETAS_ROL } from './navegacion-panel';
import { useSesionPanel } from './proveedor-sesion';

/** Calcula hasta dos iniciales en mayúsculas a partir del nombre del usuario. */
function obtenerIniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0];
  if (!primera) return 'U';
  if (partes.length === 1) return primera.slice(0, 2).toUpperCase();
  const ultima = partes[partes.length - 1] ?? primera;
  return `${primera[0] ?? ''}${ultima[0] ?? ''}`.toUpperCase();
}

/**
 * Menú desplegable de la cuenta activa en la cabecera del panel.
 *
 * Muestra nombre, correo, empresa y rol actuales, permite cambiar de empresa
 * activa cuando el usuario pertenece a más de una (`useEmpresasUsuario()`),
 * integra `SelectorTema` y permite cerrar sesión llamando a
 * `useCerrarSesion()` (que limpia la caché de TanStack Query) para luego
 * redirigir a `/ingresar`.
 */
export function MenuUsuario() {
  const sesion = useSesionPanel();
  const router = useRouter();
  const cerrarSesion = useCerrarSesion();
  const { data: empresas } = useEmpresasUsuario();
  const cambiarEmpresa = useCambiarEmpresaActiva();

  const tieneMultiplesEmpresas = Boolean(empresas && empresas.length > 1);

  async function manejarCambiarEmpresa(empresaId: string, nombreEmpresa: string) {
    try {
      await cambiarEmpresa.mutateAsync({ empresaId });
      toast.success(`Cambiaste a ${nombreEmpresa}`);
      router.refresh();
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function manejarCerrarSesion() {
    try {
      await cerrarSesion.mutateAsync();
      router.replace(RUTAS.ingresar);
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex h-9 items-center gap-2 px-2"
          aria-label={`Menú de usuario de ${sesion.usuario.nombre}`}
        >
          <Avatar className="size-7">
            <AvatarFallback className="text-xs font-medium">
              {obtenerIniciales(sesion.usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">
            {sesion.usuario.nombre}
          </span>
          <ChevronDown className="text-muted-foreground size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{sesion.usuario.nombre}</span>
              <Badge variant="secondary" className="shrink-0">
                {ETIQUETAS_ROL[sesion.rol]}
              </Badge>
            </div>
            <span className="text-muted-foreground truncate text-xs">{sesion.usuario.email}</span>
            <span className="text-muted-foreground truncate text-xs font-medium">
              {sesion.empresa.nombre}
            </span>
          </div>
        </DropdownMenuLabel>
        {tieneMultiplesEmpresas && empresas ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
              Empresas
            </DropdownMenuLabel>
            {empresas.map((empresa) => {
              const esActiva = empresa.activa || empresa.id === sesion.empresa.id;
              return (
                <DropdownMenuItem
                  key={empresa.id}
                  disabled={esActiva || cambiarEmpresa.isPending}
                  onSelect={() => {
                    void manejarCambiarEmpresa(empresa.id, empresa.nombre);
                  }}
                >
                  <Building2 className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">{empresa.nombre}</span>
                    <span className="text-muted-foreground text-xs">
                      {ETIQUETAS_ROL[empresa.rol]}
                    </span>
                  </div>
                  {esActiva ? (
                    <Check className="text-primary size-4 shrink-0" aria-label="Activa" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span>Tema</span>
          <SelectorTema />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={cerrarSesion.isPending}
          onSelect={() => {
            void manejarCerrarSesion();
          }}
        >
          <LogOut className="size-4" aria-hidden />
          <span>{cerrarSesion.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
