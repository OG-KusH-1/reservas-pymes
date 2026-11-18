'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  actualizarEmpresaSchema,
  type ActualizarEmpresa,
  type Empresa,
} from '@portfolio/contracts';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSesionPanel } from '@/components/panel/proveedor-sesion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useActualizarEmpresa } from '@/hooks/use-empresa';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';

/** Zonas horarias IANA habituales mostradas en el selector de configuración. */
const ZONAS_HORARIAS_HABITUALES: ReadonlyArray<{ valor: string; etiqueta: string }> = [
  { valor: 'America/Santiago', etiqueta: 'America/Santiago (Chile)' },
  {
    valor: 'America/Argentina/Buenos_Aires',
    etiqueta: 'America/Argentina/Buenos_Aires (Argentina)',
  },
  { valor: 'America/Lima', etiqueta: 'America/Lima (Perú)' },
  { valor: 'America/Bogota', etiqueta: 'America/Bogota (Colombia)' },
  { valor: 'America/Mexico_City', etiqueta: 'America/Mexico_City (México)' },
  { valor: 'America/Montevideo', etiqueta: 'America/Montevideo (Uruguay)' },
  { valor: 'America/Sao_Paulo', etiqueta: 'America/Sao_Paulo (Brasil)' },
  { valor: 'America/New_York', etiqueta: 'America/New_York (EE. UU. Este)' },
  { valor: 'Europe/Madrid', etiqueta: 'Europe/Madrid (España)' },
  { valor: 'UTC', etiqueta: 'UTC (Tiempo universal)' },
];

/**
 * Convierte cadenas vacías o compuestas solo por espacios en `null` para los
 * campos de texto opcionales (`rut`, `email`, `telefono`, `direccion`), de modo
 * que al borrar un dato en el formulario se envíe `null` a la API.
 */
function normalizarTextoOpcional(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function valoresInicialesDesdeEmpresa(empresa: Empresa): ActualizarEmpresa {
  return {
    nombre: empresa.nombre,
    slug: empresa.slug,
    rut: empresa.rut ?? '',
    email: empresa.email ?? '',
    telefono: empresa.telefono ?? '',
    direccion: empresa.direccion ?? '',
    zonaHoraria: empresa.zonaHoraria,
    moneda: empresa.moneda,
    anticipacionMinimaMinutos: empresa.anticipacionMinimaMinutos,
    anticipacionMaximaDias: empresa.anticipacionMaximaDias,
    cancelacionMinimaMinutos: empresa.cancelacionMinimaMinutos,
    intervaloGrillaMinutos: empresa.intervaloGrillaMinutos,
    confirmacionAutomatica: empresa.confirmacionAutomatica,
    recordatorioHorasAntes: empresa.recordatorioHorasAntes,
  };
}

/**
 * Formulario de edición del perfil de la empresa y sus políticas de reserva.
 *
 * - Solicita confirmación explícita mediante un `Dialog` cuando se modifica el
 *   `slug`, advirtiendo que los enlaces públicos actuales (`/{slug}`) dejarán
 *   de funcionar.
 * - Si el usuario tiene rol `recepcion` o `profesional`, muestra todos los
 *   campos en modo solo lectura con un aviso explicativo.
 * - Traslada los errores `VALIDACION` del servidor a cada campo con
 *   `aplicarErroresAlFormulario` y notifica el resultado con `toast`.
 */
export function FormularioConfiguracion({ empresa }: { empresa: Empresa }) {
  const sesion = useSesionPanel();
  const actualizar = useActualizarEmpresa();
  const soloLectura = sesion.rol === 'recepcion' || sesion.rol === 'profesional';

  const [datosPendientes, setDatosPendientes] = useState<ActualizarEmpresa | null>(null);

  const nombreId = useId();
  const slugId = useId();
  const rutId = useId();
  const emailId = useId();
  const telefonoId = useId();
  const direccionId = useId();
  const zonaHorariaId = useId();
  const monedaId = useId();
  const anticipacionMinId = useId();
  const anticipacionMaxId = useId();
  const cancelacionMinId = useId();
  const intervaloGrillaId = useId();
  const recordatorioId = useId();
  const confirmacionId = useId();

  const form = useForm<ActualizarEmpresa>({
    resolver: zodResolver(actualizarEmpresaSchema),
    defaultValues: valoresInicialesDesdeEmpresa(empresa),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    reset(valoresInicialesDesdeEmpresa(empresa));
  }, [empresa, reset]);

  const enviando = isSubmitting || actualizar.isPending;
  const deshabilitado = soloLectura || enviando;

  const opcionesZonaHoraria = ZONAS_HORARIAS_HABITUALES.some(
    (zona) => zona.valor === empresa.zonaHoraria,
  )
    ? ZONAS_HORARIAS_HABITUALES
    : [{ valor: empresa.zonaHoraria, etiqueta: empresa.zonaHoraria }, ...ZONAS_HORARIAS_HABITUALES];

  async function guardarCambios(datos: ActualizarEmpresa) {
    try {
      await actualizar.mutateAsync(datos);
      toast.success('Configuración guardada');
    } catch (error) {
      if (aplicarErroresAlFormulario(form, error)) {
        return;
      }
      toast.error(mensajeDeError(error));
    }
  }

  async function alEnviar(datos: ActualizarEmpresa) {
    if (soloLectura) return;

    if (datos.slug !== undefined && datos.slug !== empresa.slug) {
      setDatosPendientes(datos);
      return;
    }

    await guardarCambios(datos);
  }

  async function confirmarCambioSlug() {
    if (!datosPendientes) return;
    const pendiente = datosPendientes;
    setDatosPendientes(null);
    await guardarCambios(pendiente);
  }

  return (
    <>
      <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-6">
        {soloLectura ? (
          <Alert>
            <Info aria-hidden />
            <AlertTitle>Modo solo lectura</AlertTitle>
            <AlertDescription>
              Solo dueños y administradores pueden modificar la configuración de la empresa.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Perfil de la empresa</CardTitle>
            <CardDescription>
              Información visible para tus clientes, datos de contacto y configuración regional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.nombre)}>
                <FieldLabel htmlFor={nombreId}>Nombre de la empresa</FieldLabel>
                <Input
                  id={nombreId}
                  type="text"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.nombre)}
                  {...register('nombre')}
                />
                <FieldError errors={[errors.nombre]} />
              </Field>

              <Field data-invalid={Boolean(errors.slug)}>
                <FieldLabel htmlFor={slugId}>Identificador público (slug)</FieldLabel>
                <Input
                  id={slugId}
                  type="text"
                  autoComplete="off"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.slug)}
                  {...register('slug')}
                />
                <FieldDescription>
                  Dirección de tu página de reservas:{' '}
                  <span className="font-mono break-all">/{empresa.slug}</span>
                </FieldDescription>
                <FieldError errors={[errors.slug]} />
              </Field>

              <Field data-invalid={Boolean(errors.rut)}>
                <FieldLabel htmlFor={rutId}>RUT o identificador fiscal</FieldLabel>
                <Input
                  id={rutId}
                  type="text"
                  placeholder="76.123.456-7"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.rut)}
                  {...register('rut', { setValueAs: normalizarTextoOpcional })}
                />
                <FieldError errors={[errors.rut]} />
              </Field>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor={emailId}>Correo de contacto</FieldLabel>
                <Input
                  id={emailId}
                  type="email"
                  placeholder="contacto@tunegocio.cl"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.email)}
                  {...register('email', { setValueAs: normalizarTextoOpcional })}
                />
                <FieldError errors={[errors.email]} />
              </Field>

              <Field data-invalid={Boolean(errors.telefono)}>
                <FieldLabel htmlFor={telefonoId}>Teléfono</FieldLabel>
                <Input
                  id={telefonoId}
                  type="tel"
                  placeholder="+56 9 1234 5678"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.telefono)}
                  {...register('telefono', { setValueAs: normalizarTextoOpcional })}
                />
                <FieldError errors={[errors.telefono]} />
              </Field>

              <Field data-invalid={Boolean(errors.direccion)}>
                <FieldLabel htmlFor={direccionId}>Dirección</FieldLabel>
                <Input
                  id={direccionId}
                  type="text"
                  placeholder="Av. Providencia 1234, Santiago"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.direccion)}
                  {...register('direccion', { setValueAs: normalizarTextoOpcional })}
                />
                <FieldError errors={[errors.direccion]} />
              </Field>

              <Field data-invalid={Boolean(errors.zonaHoraria)}>
                <FieldLabel htmlFor={zonaHorariaId}>Zona horaria</FieldLabel>
                <Controller
                  control={control}
                  name="zonaHoraria"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? empresa.zonaHoraria}
                      onValueChange={field.onChange}
                      disabled={deshabilitado}
                    >
                      <SelectTrigger
                        id={zonaHorariaId}
                        className="w-full"
                        aria-invalid={Boolean(errors.zonaHoraria)}
                      >
                        <SelectValue placeholder="Selecciona una zona horaria" />
                      </SelectTrigger>
                      <SelectContent>
                        {opcionesZonaHoraria.map((zona) => (
                          <SelectItem key={zona.valor} value={zona.valor}>
                            {zona.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  Define la hora local de los horarios de atención y las reservas.
                </FieldDescription>
                <FieldError errors={[errors.zonaHoraria]} />
              </Field>

              <Field data-invalid={Boolean(errors.moneda)}>
                <FieldLabel htmlFor={monedaId}>Moneda (ISO 4217)</FieldLabel>
                <Input
                  id={monedaId}
                  type="text"
                  maxLength={3}
                  placeholder="CLP"
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.moneda)}
                  {...register('moneda', {
                    setValueAs: (valor: unknown) =>
                      typeof valor === 'string' ? valor.trim().toUpperCase() : valor,
                  })}
                />
                <FieldDescription>
                  Código de 3 letras en mayúsculas (ej. CLP, USD).
                </FieldDescription>
                <FieldError errors={[errors.moneda]} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Políticas de reserva</CardTitle>
            <CardDescription>
              Reglas que controlan cuándo y cómo pueden agendar tus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.anticipacionMinimaMinutos)}>
                <FieldLabel htmlFor={anticipacionMinId}>Anticipación mínima (minutos)</FieldLabel>
                <Input
                  id={anticipacionMinId}
                  type="number"
                  min={0}
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.anticipacionMinimaMinutos)}
                  {...register('anticipacionMinimaMinutos', { valueAsNumber: true })}
                />
                <FieldDescription>
                  Tiempo mínimo antes de la cita para reservar. Usa 0 para permitir reservas
                  inmediatas.
                </FieldDescription>
                <FieldError errors={[errors.anticipacionMinimaMinutos]} />
              </Field>

              <Field data-invalid={Boolean(errors.anticipacionMaximaDias)}>
                <FieldLabel htmlFor={anticipacionMaxId}>Anticipación máxima (días)</FieldLabel>
                <Input
                  id={anticipacionMaxId}
                  type="number"
                  min={1}
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.anticipacionMaximaDias)}
                  {...register('anticipacionMaximaDias', { valueAsNumber: true })}
                />
                <FieldDescription>
                  Cuántos días hacia el futuro puede agendar un cliente (mínimo 1).
                </FieldDescription>
                <FieldError errors={[errors.anticipacionMaximaDias]} />
              </Field>

              <Field data-invalid={Boolean(errors.cancelacionMinimaMinutos)}>
                <FieldLabel htmlFor={cancelacionMinId}>
                  Ventana mínima de cancelación (minutos)
                </FieldLabel>
                <Input
                  id={cancelacionMinId}
                  type="number"
                  min={0}
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.cancelacionMinimaMinutos)}
                  {...register('cancelacionMinimaMinutos', { valueAsNumber: true })}
                />
                <FieldDescription>
                  Antelación mínima para que el cliente pueda cancelar o reagendar su cita.
                </FieldDescription>
                <FieldError errors={[errors.cancelacionMinimaMinutos]} />
              </Field>

              <Field data-invalid={Boolean(errors.intervaloGrillaMinutos)}>
                <FieldLabel htmlFor={intervaloGrillaId}>
                  Intervalo de la grilla (minutos)
                </FieldLabel>
                <Input
                  id={intervaloGrillaId}
                  type="number"
                  min={5}
                  max={120}
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.intervaloGrillaMinutos)}
                  {...register('intervaloGrillaMinutos', { valueAsNumber: true })}
                />
                <FieldDescription>
                  Frecuencia de horarios disponibles en la agenda (entre 5 y 120 minutos).
                </FieldDescription>
                <FieldError errors={[errors.intervaloGrillaMinutos]} />
              </Field>

              <Field data-invalid={Boolean(errors.recordatorioHorasAntes)}>
                <FieldLabel htmlFor={recordatorioId}>Recordatorio previo (horas)</FieldLabel>
                <Input
                  id={recordatorioId}
                  type="number"
                  min={0}
                  disabled={deshabilitado}
                  aria-invalid={Boolean(errors.recordatorioHorasAntes)}
                  {...register('recordatorioHorasAntes', { valueAsNumber: true })}
                />
                <FieldDescription>
                  Horas antes de la cita para enviar el recordatorio. Usa 0 para desactivarlo.
                </FieldDescription>
                <FieldError errors={[errors.recordatorioHorasAntes]} />
              </Field>

              <Field
                orientation="horizontal"
                className="items-center justify-between rounded-lg border p-3 sm:col-span-2"
              >
                <div className="space-y-0.5">
                  <FieldLabel htmlFor={confirmacionId}>Confirmación automática</FieldLabel>
                  <FieldDescription>
                    Si está activa, las reservas públicas se confirman de inmediato; si no, quedan
                    pendientes de aprobación.
                  </FieldDescription>
                </div>
                <Controller
                  control={control}
                  name="confirmacionAutomatica"
                  render={({ field }) => (
                    <Switch
                      id={confirmacionId}
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      disabled={deshabilitado}
                    />
                  )}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {!soloLectura ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={enviando} className="w-full sm:w-auto">
              {enviando ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Guardando...
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </div>
        ) : null}
      </form>

      <Dialog
        open={datosPendientes !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setDatosPendientes(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-5 shrink-0" aria-hidden />
              ¿Cambiar el identificador público?
            </DialogTitle>
            <DialogDescription>
              Al cambiar el identificador de{' '}
              <span className="text-foreground font-mono">/{empresa.slug}</span> a{' '}
              <span className="text-foreground font-mono">/{datosPendientes?.slug}</span>, los
              enlaces públicos existentes dejarán de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDatosPendientes(null)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmarCambioSlug} disabled={enviando}>
              Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
