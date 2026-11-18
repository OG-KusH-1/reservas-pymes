'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  crearInvitacionSchema,
  ROLES_MIEMBRO,
  type CrearInvitacion,
  type Miembro,
  type RolMiembro,
} from '@portfolio/contracts';
import { AlertCircle, Loader2, MailPlus, RefreshCw, Trash2, UserCheck, Users } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ETIQUETAS_ROL } from '@/components/panel/navegacion-panel';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import {
  useActualizarMiembro,
  useCrearInvitacion,
  useEliminarMiembro,
  useInvitaciones,
  useMiembros,
  useRevocarInvitacion,
} from '@/hooks/use-equipo';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { formatearFechaCorta } from '@/lib/formato';

/**
 * Gestión del equipo e invitaciones de la empresa activa (`/panel/equipo`).
 *
 * Muestra la tabla de miembros con su rol, estado activo y verificación de
 * correo. Quienes tienen rol `dueno` o `admin` pueden cambiar roles (solo
 * `dueno` asigna o quita `dueno`, y nadie puede editar o eliminar su propia
 * membresía), activar o desactivar miembros, eliminarlos con confirmación y
 * gestionar invitaciones pendientes.
 */
export function GestionEquipo() {
  const sesion = useSesionPanel();
  const esDueno = sesion.rol === 'dueno';
  const puedeAdministrar = esDueno || sesion.rol === 'admin';

  const miembrosQuery = useMiembros();
  const invitacionesQuery = useInvitaciones({ enabled: puedeAdministrar });
  const actualizarMiembro = useActualizarMiembro();
  const eliminarMiembro = useEliminarMiembro();
  const crearInvitacion = useCrearInvitacion();
  const revocarInvitacion = useRevocarInvitacion();

  const [miembroAEliminar, setMiembroAEliminar] = useState<Miembro | null>(null);
  const [errorInvitacion, setErrorInvitacion] = useState<string | null>(null);

  const emailInvitacionId = useId();
  const emailInvitacionErrorId = useId();
  const rolInvitacionId = useId();
  const rolInvitacionErrorId = useId();

  const rolesAsignables: readonly RolMiembro[] = esDueno
    ? ROLES_MIEMBRO
    : ROLES_MIEMBRO.filter((rol) => rol !== 'dueno');

  const formInvitacion = useForm<CrearInvitacion>({
    resolver: zodResolver(crearInvitacionSchema),
    defaultValues: { email: '', rol: 'profesional' },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = formInvitacion;

  async function manejarCambioRol(miembro: Miembro, nuevoRol: RolMiembro) {
    if (nuevoRol === miembro.rol) return;
    try {
      await actualizarMiembro.mutateAsync({ id: miembro.id, datos: { rol: nuevoRol } });
      toast.success(`Rol de ${miembro.nombre} actualizado a ${ETIQUETAS_ROL[nuevoRol]}`);
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function manejarCambioActivo(miembro: Miembro, activo: boolean) {
    try {
      await actualizarMiembro.mutateAsync({ id: miembro.id, datos: { activo } });
      toast.success(
        activo ? `${miembro.nombre} fue activado` : `${miembro.nombre} fue desactivado`,
      );
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function confirmarEliminacion() {
    if (!miembroAEliminar) return;
    try {
      await eliminarMiembro.mutateAsync(miembroAEliminar.id);
      toast.success(`${miembroAEliminar.nombre} fue eliminado del equipo`);
      setMiembroAEliminar(null);
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  async function enviarInvitacion(datos: CrearInvitacion) {
    setErrorInvitacion(null);
    try {
      await crearInvitacion.mutateAsync(datos);
      toast.success(`Invitación enviada a ${datos.email}`);
      reset({ email: '', rol: 'profesional' });
    } catch (error) {
      if (!aplicarErroresAlFormulario(formInvitacion, error)) {
        setErrorInvitacion(mensajeDeError(error));
      }
    }
  }

  async function manejarRevocarInvitacion(id: string, email: string) {
    try {
      await revocarInvitacion.mutateAsync(id);
      toast.success(`Invitación para ${email} revocada`);
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-muted-foreground text-sm">
          Administra los miembros de {sesion.empresa.nombre} y las invitaciones pendientes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" aria-hidden />
            Miembros del equipo
          </CardTitle>
          <CardDescription>
            Personas que tienen acceso al panel de esta empresa según su rol.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {miembrosQuery.isPending ? (
            <div className="space-y-3" aria-label="Cargando miembros">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : miembrosQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>No pudimos cargar el equipo</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{mensajeDeError(miembrosQuery.error)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => void miembrosQuery.refetch()}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : miembrosQuery.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <UserCheck className="text-muted-foreground size-8" aria-hidden />
              <p className="text-sm font-medium">Aún no hay miembros registrados</p>
              <p className="text-muted-foreground text-xs">
                Invita a tu equipo para que puedan gestionar la agenda.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  {puedeAdministrar ? <TableHead className="text-right">Acciones</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {miembrosQuery.data.map((miembro) => {
                  const esPropio = miembro.usuarioId === sesion.usuario.id;
                  const protegidoPorDueno = !esDueno && miembro.rol === 'dueno';
                  const puedeEditarMiembro = puedeAdministrar && !esPropio && !protegidoPorDueno;

                  return (
                    <TableRow key={miembro.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{miembro.nombre}</span>
                          {esPropio ? (
                            <Badge variant="outline" className="text-xs">
                              Tú
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <span className="text-sm">{miembro.email}</span>
                          <Badge
                            variant={miembro.emailVerificado ? 'secondary' : 'outline'}
                            className="w-fit text-xs"
                          >
                            {miembro.emailVerificado ? 'Verificado' : 'Sin verificar'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {puedeEditarMiembro ? (
                          <Select
                            value={miembro.rol}
                            disabled={actualizarMiembro.isPending}
                            onValueChange={(valor) => {
                              void manejarCambioRol(miembro, valor as RolMiembro);
                            }}
                          >
                            <SelectTrigger aria-label={`Rol de ${miembro.nombre}`} className="w-38">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {rolesAsignables.map((rol) => (
                                <SelectItem key={rol} value={rol}>
                                  {ETIQUETAS_ROL[rol]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">{ETIQUETAS_ROL[miembro.rol]}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {puedeEditarMiembro ? (
                            <Switch
                              checked={miembro.activo}
                              disabled={actualizarMiembro.isPending}
                              aria-label={`Estado activo de ${miembro.nombre}`}
                              onCheckedChange={(checked) => {
                                void manejarCambioActivo(miembro, checked);
                              }}
                            />
                          ) : null}
                          <Badge variant={miembro.activo ? 'default' : 'outline'}>
                            {miembro.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>
                      </TableCell>
                      {puedeAdministrar ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={!puedeEditarMiembro || eliminarMiembro.isPending}
                            aria-label={`Eliminar a ${miembro.nombre}`}
                            onClick={() => setMiembroAEliminar(miembro)}
                          >
                            <Trash2 className="text-destructive size-4" aria-hidden />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {puedeAdministrar ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MailPlus className="size-4" aria-hidden />
                Invitar miembro
              </CardTitle>
              <CardDescription>
                Envía una invitación por correo para sumarse a {sesion.empresa.nombre}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit(enviarInvitacion)}
                noValidate
                className="flex flex-col gap-4"
              >
                {errorInvitacion ? (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden />
                    <AlertDescription>{errorInvitacion}</AlertDescription>
                  </Alert>
                ) : null}

                <FieldGroup>
                  <Field data-invalid={Boolean(errors.email)}>
                    <FieldLabel htmlFor={emailInvitacionId}>Correo electrónico</FieldLabel>
                    <Input
                      id={emailInvitacionId}
                      type="email"
                      autoComplete="email"
                      placeholder="colega@empresa.cl"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? emailInvitacionErrorId : undefined}
                      {...register('email')}
                    />
                    <FieldError id={emailInvitacionErrorId} errors={[errors.email]} />
                  </Field>

                  <Field data-invalid={Boolean(errors.rol)}>
                    <FieldLabel htmlFor={rolInvitacionId}>Rol</FieldLabel>
                    <Controller
                      name="rol"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            id={rolInvitacionId}
                            aria-invalid={Boolean(errors.rol)}
                            aria-describedby={errors.rol ? rolInvitacionErrorId : undefined}
                          >
                            <SelectValue placeholder="Selecciona un rol" />
                          </SelectTrigger>
                          <SelectContent>
                            {rolesAsignables.map((rol) => (
                              <SelectItem key={rol} value={rol}>
                                {ETIQUETAS_ROL[rol]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError id={rolInvitacionErrorId} errors={[errors.rol]} />
                  </Field>
                </FieldGroup>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || crearInvitacion.isPending}
                >
                  {isSubmitting || crearInvitacion.isPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden />
                      Enviando invitación…
                    </>
                  ) : (
                    'Enviar invitación'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Invitaciones pendientes</CardTitle>
              <CardDescription>
                Invitaciones enviadas que aún no han sido aceptadas ni han expirado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitacionesQuery.isPending ? (
                <div className="space-y-3" aria-label="Cargando invitaciones">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : invitacionesQuery.isError ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden />
                  <AlertTitle>No pudimos cargar las invitaciones</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>{mensajeDeError(invitacionesQuery.error)}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => void invitacionesQuery.refetch()}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      Reintentar
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : invitacionesQuery.data.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No hay invitaciones pendientes en este momento.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Correo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Expira</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitacionesQuery.data.map((invitacion) => (
                      <TableRow key={invitacion.id}>
                        <TableCell className="font-medium">{invitacion.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ETIQUETAS_ROL[invitacion.rol]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatearFechaCorta(invitacion.expiraEn, sesion.empresa.zonaHoraria)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={revocarInvitacion.isPending}
                            onClick={() => {
                              void manejarRevocarInvitacion(invitacion.id, invitacion.email);
                            }}
                          >
                            Revocar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Dialog
        open={Boolean(miembroAEliminar)}
        onOpenChange={(abierto) => {
          if (!abierto) setMiembroAEliminar(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar miembro del equipo</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar a{' '}
              <strong className="text-foreground font-medium">{miembroAEliminar?.nombre}</strong> (
              {miembroAEliminar?.email}) de {sesion.empresa.nombre}? Perderá el acceso al panel de
              esta empresa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={eliminarMiembro.isPending}
              onClick={() => setMiembroAEliminar(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={eliminarMiembro.isPending}
              onClick={() => {
                void confirmarEliminacion();
              }}
            >
              {eliminarMiembro.isPending ? (
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
