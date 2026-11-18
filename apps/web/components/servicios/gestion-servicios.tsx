'use client';

import type { Servicio } from '@portfolio/contracts';
import {
  AlertCircle,
  Briefcase,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSesionPanel } from '@/components/panel/proveedor-sesion';
import { DialogoServicio } from '@/components/servicios/dialogo-servicio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useActualizarServicio, useEliminarServicio, useServicios } from '@/hooks/use-servicios';
import { mensajeDeError } from '@/lib/api/errores';
import { formatearDuracion, formatearMoneda } from '@/lib/formato';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';
const CATEGORIA_TODAS = '__todas__';
const RETARDO_BUSQUEDA_MS = 300;

/**
 * Gestión del catálogo de servicios de la empresa activa (`/panel/servicios`).
 *
 * Cualquier miembro autenticado puede consultar el catálogo; solo los roles
 * `dueno` y `admin` ven las acciones de creación, edición, activación y
 * eliminación. Mantiene un conjunto acumulado de categorías observadas para
 * que el selector no pierda opciones al filtrar por una categoría puntual.
 */
export function GestionServicios() {
  const sesion = useSesionPanel();
  const puedeAdministrar = sesion.rol === 'dueno' || sesion.rol === 'admin';

  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>(CATEGORIA_TODAS);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [servicioEnEdicion, setServicioEnEdicion] = useState<Servicio | null>(null);
  const [servicioAEliminar, setServicioAEliminar] = useState<Servicio | null>(null);
  const [errorEliminacion, setErrorEliminacion] = useState<string | null>(null);

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
    }, RETARDO_BUSQUEDA_MS);

    return () => clearTimeout(temporizador);
  }, [busqueda]);

  const activoParam =
    estadoFiltro === 'activos' ? true : estadoFiltro === 'inactivos' ? false : undefined;
  const categoriaParam = categoriaFiltro === CATEGORIA_TODAS ? undefined : categoriaFiltro;

  const serviciosQuery = useServicios({
    activo: activoParam,
    categoria: categoriaParam,
    q: busquedaDebounced || undefined,
  });

  const actualizarServicio = useActualizarServicio();
  const eliminarServicio = useEliminarServicio();

  const servicios = useMemo(
    () => serviciosQuery.data?.pages.flatMap((pagina) => pagina.datos) ?? [],
    [serviciosQuery.data],
  );

  const categoriasConocidas = useMemo(() => {
    const conjunto = new Set<string>();
    if (categoriaFiltro !== CATEGORIA_TODAS) {
      conjunto.add(categoriaFiltro);
    }
    for (const servicio of servicios) {
      const categoria = servicio.categoria?.trim();
      if (categoria) conjunto.add(categoria);
    }
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, 'es'));
  }, [servicios, categoriaFiltro]);

  const hayFiltrosActivos =
    Boolean(busquedaDebounced) || estadoFiltro !== 'todos' || categoriaFiltro !== CATEGORIA_TODAS;

  function abrirCreacion() {
    setServicioEnEdicion(null);
    setDialogoAbierto(true);
  }

  function abrirEdicion(servicio: Servicio) {
    setServicioEnEdicion(servicio);
    setDialogoAbierto(true);
  }

  function limpiarFiltros() {
    setBusqueda('');
    setBusquedaDebounced('');
    setEstadoFiltro('todos');
    setCategoriaFiltro(CATEGORIA_TODAS);
  }

  async function manejarCambioActivo(servicio: Servicio, activo: boolean) {
    try {
      await actualizarServicio.mutateAsync({ id: servicio.id, datos: { activo } });
      toast.success(
        activo
          ? `Servicio «${servicio.nombre}» activado`
          : `Servicio «${servicio.nombre}» desactivado`,
      );
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function confirmarEliminacion() {
    if (!servicioAEliminar) return;
    setErrorEliminacion(null);

    try {
      await eliminarServicio.mutateAsync(servicioAEliminar.id);
      toast.success(`Servicio «${servicioAEliminar.nombre}» eliminado`);
      setServicioAEliminar(null);
    } catch (error) {
      setErrorEliminacion(mensajeDeError(error));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Servicios</h1>
          <p className="text-muted-foreground text-sm">
            Administra el catálogo de servicios de {sesion.empresa.nombre}.
          </p>
        </div>

        {puedeAdministrar ? (
          <Button type="button" onClick={abrirCreacion} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden />
            Nuevo servicio
          </Button>
        ) : null}
      </header>

      <Card>
        <CardHeader className="gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="size-4" aria-hidden />
              Catálogo de servicios
            </CardTitle>
            <CardDescription>
              Duraciones, precios en {sesion.empresa.moneda} y visibilidad en la página pública.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o descripción..."
                aria-label="Buscar servicios"
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <Select
                value={estadoFiltro}
                onValueChange={(valor) => setEstadoFiltro(valor as FiltroEstado)}
              >
                <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="inactivos">Inactivos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger aria-label="Filtrar por categoría" className="w-full sm:w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORIA_TODAS}>Todas las categorías</SelectItem>
                  {categoriasConocidas.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {serviciosQuery.isPending ? (
            <div className="space-y-3" aria-label="Cargando servicios">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : serviciosQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>No pudimos cargar los servicios</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{mensajeDeError(serviciosQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => void serviciosQuery.refetch()}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : servicios.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Briefcase className="text-muted-foreground size-8" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {hayFiltrosActivos
                    ? 'No hay servicios que coincidan con los filtros'
                    : 'Aún no hay servicios en el catálogo'}
                </p>
                <p className="text-muted-foreground text-xs">
                  {hayFiltrosActivos
                    ? 'Prueba con otro texto de búsqueda o limpia los filtros activos.'
                    : 'Crea tu primer servicio para asignarlo a profesionales y recibir reservas.'}
                </p>
              </div>
              {hayFiltrosActivos ? (
                <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Button>
              ) : puedeAdministrar ? (
                <Button type="button" size="sm" onClick={abrirCreacion}>
                  <Plus className="size-4" aria-hidden />
                  Crear primer servicio
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Estado</TableHead>
                    {puedeAdministrar ? (
                      <TableHead className="text-right">Acciones</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicios.map((servicio) => (
                    <TableRow key={servicio.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-start gap-2.5">
                          <span
                            aria-hidden
                            className="border-border bg-muted mt-1 size-3 shrink-0 rounded-full border"
                            style={servicio.color ? { backgroundColor: servicio.color } : undefined}
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate">{servicio.nombre}</span>
                              <Badge variant="outline" className="gap-1 text-xs font-normal">
                                {servicio.visiblePublico ? (
                                  <>
                                    <Eye className="size-3" aria-hidden />
                                    Público
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="size-3" aria-hidden />
                                    Solo panel
                                  </>
                                )}
                              </Badge>
                            </div>
                            {servicio.descripcion ? (
                              <p className="text-muted-foreground line-clamp-1 text-xs font-normal">
                                {servicio.descripcion}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {servicio.categoria ? (
                          <span className="text-sm">{servicio.categoria}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Sin categoría</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatearDuracion(servicio.duracionMinutos)}</span>
                          {servicio.margenPosteriorMinutos > 0 ? (
                            <span className="text-muted-foreground text-xs">
                              + {formatearDuracion(servicio.margenPosteriorMinutos)} prep.
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {formatearMoneda(servicio.precio, sesion.empresa.moneda)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {puedeAdministrar ? (
                            <Switch
                              checked={servicio.activo}
                              disabled={actualizarServicio.isPending}
                              aria-label={`Estado activo de ${servicio.nombre}`}
                              onCheckedChange={(checked) => {
                                void manejarCambioActivo(servicio, checked);
                              }}
                            />
                          ) : null}
                          <Badge variant={servicio.activo ? 'default' : 'outline'}>
                            {servicio.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </TableCell>

                      {puedeAdministrar ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${servicio.nombre}`}
                              onClick={() => abrirEdicion(servicio)}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={eliminarServicio.isPending}
                              aria-label={`Eliminar ${servicio.nombre}`}
                              onClick={() => {
                                setErrorEliminacion(null);
                                setServicioAEliminar(servicio);
                              }}
                            >
                              <Trash2 className="text-destructive size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {serviciosQuery.hasNextPage ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={serviciosQuery.isFetchingNextPage}
                    onClick={() => void serviciosQuery.fetchNextPage()}
                  >
                    {serviciosQuery.isFetchingNextPage ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Cargando...
                      </>
                    ) : (
                      'Cargar más'
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <DialogoServicio
        abierto={dialogoAbierto}
        alCambiarAbierto={setDialogoAbierto}
        servicio={servicioEnEdicion}
        moneda={sesion.empresa.moneda}
      />

      <Dialog
        open={Boolean(servicioAEliminar)}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setServicioAEliminar(null);
            setErrorEliminacion(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar servicio</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar{' '}
              <span className="text-foreground font-medium">{servicioAEliminar?.nombre}</span>? Esta
              acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {errorEliminacion ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertDescription>{errorEliminacion}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={eliminarServicio.isPending}
              onClick={() => {
                setServicioAEliminar(null);
                setErrorEliminacion(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={eliminarServicio.isPending}
              onClick={() => void confirmarEliminacion()}
            >
              {eliminarServicio.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Eliminando...
                </>
              ) : (
                'Eliminar servicio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
