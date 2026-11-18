'use client';

import type { Miembro, Profesional } from '@portfolio/contracts';
import {
  AlertCircle,
  Briefcase,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSesionPanel } from '@/components/panel/proveedor-sesion';
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
import { useMiembros } from '@/hooks/use-equipo';
import {
  useActualizarProfesional,
  useEliminarProfesional,
  useProfesionales,
  useServiciosParaProfesionales,
  type FiltrosProfesionales,
} from '@/hooks/use-profesionales';
import { esApiError, mensajeDeError } from '@/lib/api/errores';
import { RUTAS } from '@/lib/rutas';
import { DialogoAsignarServicios } from './dialogo-asignar-servicios';
import { DialogoProfesional } from './dialogo-profesional';
import { DialogoVincularUsuario } from './dialogo-vincular-usuario';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';
const VALOR_TODOS_SERVICIOS = '__todos__';

/**
 * Pantalla de gestión de profesionales de la empresa activa
 * (`/panel/equipo/profesionales`).
 *
 * Cualquier rol autenticado puede consultar el listado filtrado y paginado,
 * mientras que solo `dueno` y `admin` pueden crear, editar, activar/desactivar,
 * asignar servicios, vincular cuentas miembro o eliminar profesionales.
 */
export function GestionProfesionales() {
  const sesion = useSesionPanel();
  const puedeAdministrar = sesion.rol === 'dueno' || sesion.rol === 'admin';

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroServicioId, setFiltroServicioId] = useState<string>(VALOR_TODOS_SERVICIOS);

  const filtros: FiltrosProfesionales = useMemo(() => {
    const q = busqueda.trim();
    return {
      ...(filtroEstado === 'activos' ? { activo: true } : {}),
      ...(filtroEstado === 'inactivos' ? { activo: false } : {}),
      ...(filtroServicioId !== VALOR_TODOS_SERVICIOS ? { servicioId: filtroServicioId } : {}),
      ...(q ? { q } : {}),
    };
  }, [busqueda, filtroEstado, filtroServicioId]);

  const hayFiltrosActivos =
    Boolean(busqueda.trim()) ||
    filtroEstado !== 'todos' ||
    filtroServicioId !== VALOR_TODOS_SERVICIOS;

  const profesionalesQuery = useProfesionales(filtros);
  const serviciosQuery = useServiciosParaProfesionales();
  const miembrosQuery = useMiembros();
  const actualizarProfesional = useActualizarProfesional();
  const eliminarProfesional = useEliminarProfesional();

  const [dialogoProfesionalAbierto, setDialogoProfesionalAbierto] = useState(false);
  const [profesionalEnEdicion, setProfesionalEnEdicion] = useState<Profesional | null>(null);
  const [profesionalParaServicios, setProfesionalParaServicios] = useState<Profesional | null>(
    null,
  );
  const [profesionalParaUsuario, setProfesionalParaUsuario] = useState<Profesional | null>(null);
  const [profesionalAEliminar, setProfesionalAEliminar] = useState<Profesional | null>(null);
  const [errorEliminacion, setErrorEliminacion] = useState<string | null>(null);

  const profesionales = useMemo(
    () => profesionalesQuery.data?.pages.flatMap((pagina) => pagina.datos) ?? [],
    [profesionalesQuery.data],
  );

  const miembrosPorUsuarioId = useMemo(() => {
    const mapa = new Map<string, Miembro>();
    for (const miembro of miembrosQuery.data ?? []) {
      mapa.set(miembro.usuarioId, miembro);
    }
    return mapa;
  }, [miembrosQuery.data]);

  function limpiarFiltros() {
    setBusqueda('');
    setFiltroEstado('todos');
    setFiltroServicioId(VALOR_TODOS_SERVICIOS);
  }

  function abrirCrearProfesional() {
    setProfesionalEnEdicion(null);
    setDialogoProfesionalAbierto(true);
  }

  function abrirEditarProfesional(profesional: Profesional) {
    setProfesionalEnEdicion(profesional);
    setDialogoProfesionalAbierto(true);
  }

  async function manejarCambioActivo(profesional: Profesional, activo: boolean) {
    try {
      await actualizarProfesional.mutateAsync({
        id: profesional.id,
        datos: { activo },
      });
      toast.success(
        activo ? `${profesional.nombre} fue activado` : `${profesional.nombre} fue desactivado`,
      );
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function confirmarEliminacion() {
    if (!profesionalAEliminar) return;
    setErrorEliminacion(null);
    try {
      await eliminarProfesional.mutateAsync(profesionalAEliminar.id);
      toast.success(`${profesionalAEliminar.nombre} fue eliminado`);
      setProfesionalAEliminar(null);
    } catch (error) {
      if (esApiError(error, 'CONFLICTO')) {
        setErrorEliminacion(error.message);
        return;
      }
      setErrorEliminacion(mensajeDeError(error));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Link
              href={RUTAS.panel.equipo}
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Equipo
            </Link>
            <span aria-hidden>/</span>
            <span>Profesionales</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Profesionales</h1>
          <p className="text-muted-foreground text-sm">
            Administra quienes atienden citas en {sesion.empresa.nombre}, sus servicios y su vínculo
            con cuentas del panel.
          </p>
        </div>

        {puedeAdministrar ? (
          <Button type="button" onClick={abrirCrearProfesional} className="w-full sm:w-auto">
            <Plus aria-hidden />
            Nuevo profesional
          </Button>
        ) : null}
      </header>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4" aria-hidden />
              Listado de profesionales
            </CardTitle>
            <CardDescription>
              Filtra por nombre, correo, estado o servicio asignado.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por nombre o correo…"
                aria-label="Buscar profesionales"
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-center">
              <Select
                value={filtroEstado}
                onValueChange={(valor) => setFiltroEstado(valor as FiltroEstado)}
              >
                <SelectTrigger aria-label="Filtrar por estado" className="w-full md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="inactivos">Inactivos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroServicioId} onValueChange={setFiltroServicioId}>
                <SelectTrigger aria-label="Filtrar por servicio" className="w-full md:w-52">
                  <SelectValue placeholder="Todos los servicios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VALOR_TODOS_SERVICIOS}>Todos los servicios</SelectItem>
                  {(serviciosQuery.data ?? []).map((servicio) => (
                    <SelectItem key={servicio.id} value={servicio.id}>
                      {servicio.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {profesionalesQuery.isPending ? (
            <div className="space-y-3" aria-label="Cargando profesionales">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : profesionalesQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>No pudimos cargar los profesionales</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{mensajeDeError(profesionalesQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => void profesionalesQuery.refetch()}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : profesionales.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Users className="text-muted-foreground size-8" aria-hidden />
              {hayFiltrosActivos ? (
                <>
                  <p className="text-sm font-medium">
                    No encontramos profesionales con esos filtros
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Prueba ajustando la búsqueda o limpiando los filtros aplicados.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Aún no hay profesionales registrados</p>
                  <p className="text-muted-foreground text-xs">
                    Agrega al primer profesional para asignarle servicios y horarios.
                  </p>
                  {puedeAdministrar ? (
                    <Button type="button" size="sm" onClick={abrirCrearProfesional}>
                      <Plus aria-hidden />
                      Nuevo profesional
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Cuenta vinculada</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Estado</TableHead>
                    {puedeAdministrar ? (
                      <TableHead className="text-right">Acciones</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profesionales.map((profesional) => {
                    const miembroVinculado = profesional.usuarioId
                      ? miembrosPorUsuarioId.get(profesional.usuarioId)
                      : undefined;

                    return (
                      <TableRow key={profesional.id}>
                        <TableCell className="font-medium">{profesional.nombre}</TableCell>
                        <TableCell>
                          {profesional.email || profesional.telefono ? (
                            <div className="flex flex-col text-sm">
                              {profesional.email ? <span>{profesional.email}</span> : null}
                              {profesional.telefono ? (
                                <span className="text-muted-foreground text-xs">
                                  {profesional.telefono}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin contacto</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {profesional.usuarioId ? (
                            miembroVinculado ? (
                              <div className="flex flex-col text-sm">
                                <span>{miembroVinculado.nombre}</span>
                                <span className="text-muted-foreground text-xs">
                                  {miembroVinculado.email}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="secondary">Cuenta vinculada</Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Sin cuenta vinculada
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {profesional.servicios.length === 0 ? (
                            <span className="text-muted-foreground text-xs">Sin servicios</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {profesional.servicios.map((servicio) => (
                                <Badge
                                  key={servicio.id}
                                  variant="secondary"
                                  className="gap-1.5 font-normal"
                                >
                                  <span
                                    className="bg-muted-foreground/40 size-2 rounded-full"
                                    style={
                                      servicio.color
                                        ? { backgroundColor: servicio.color }
                                        : undefined
                                    }
                                    aria-hidden
                                  />
                                  {servicio.nombre}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {puedeAdministrar ? (
                              <Switch
                                checked={profesional.activo}
                                disabled={actualizarProfesional.isPending}
                                aria-label={`Estado activo de ${profesional.nombre}`}
                                onCheckedChange={(checked) => {
                                  void manejarCambioActivo(profesional, checked);
                                }}
                              />
                            ) : null}
                            <Badge variant={profesional.activo ? 'default' : 'outline'}>
                              {profesional.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                        </TableCell>
                        {puedeAdministrar ? (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Editar a ${profesional.nombre}`}
                                onClick={() => abrirEditarProfesional(profesional)}
                              >
                                <Pencil className="size-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Asignar servicios a ${profesional.nombre}`}
                                onClick={() => setProfesionalParaServicios(profesional)}
                              >
                                <Briefcase className="size-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Vincular cuenta de ${profesional.nombre}`}
                                onClick={() => setProfesionalParaUsuario(profesional)}
                              >
                                <Link2 className="size-4" aria-hidden />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Eliminar a ${profesional.nombre}`}
                                onClick={() => {
                                  setErrorEliminacion(null);
                                  setProfesionalAEliminar(profesional);
                                }}
                              >
                                <Trash2 className="text-destructive size-4" aria-hidden />
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {profesionalesQuery.hasNextPage ? (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={profesionalesQuery.isFetchingNextPage}
                    onClick={() => void profesionalesQuery.fetchNextPage()}
                  >
                    {profesionalesQuery.isFetchingNextPage ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden />
                        Cargando…
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

      <DialogoProfesional
        abierto={dialogoProfesionalAbierto}
        profesional={profesionalEnEdicion}
        alCerrar={() => setDialogoProfesionalAbierto(false)}
      />

      <DialogoAsignarServicios
        profesional={profesionalParaServicios}
        servicios={serviciosQuery.data ?? []}
        cargandoServicios={serviciosQuery.isPending}
        alCerrar={() => setProfesionalParaServicios(null)}
      />

      <DialogoVincularUsuario
        profesional={profesionalParaUsuario}
        miembros={miembrosQuery.data ?? []}
        cargandoMiembros={miembrosQuery.isPending}
        alCerrar={() => setProfesionalParaUsuario(null)}
      />

      <Dialog
        open={Boolean(profesionalAEliminar)}
        onOpenChange={(abierto) => {
          if (!abierto && !eliminarProfesional.isPending) {
            setErrorEliminacion(null);
            setProfesionalAEliminar(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar profesional</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar a{' '}
              <strong className="text-foreground font-medium">
                {profesionalAEliminar?.nombre}
              </strong>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {errorEliminacion ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>No se pudo eliminar el profesional</AlertTitle>
              <AlertDescription>{errorEliminacion}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={eliminarProfesional.isPending}
              onClick={() => {
                setErrorEliminacion(null);
                setProfesionalAEliminar(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={eliminarProfesional.isPending}
              onClick={() => {
                void confirmarEliminacion();
              }}
            >
              {eliminarProfesional.isPending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Eliminando…
                </>
              ) : (
                'Confirmar eliminación'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
