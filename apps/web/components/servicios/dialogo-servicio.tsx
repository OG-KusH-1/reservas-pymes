'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { crearServicioSchema, type CrearServicio, type Servicio } from '@portfolio/contracts';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useActualizarServicio, useCrearServicio } from '@/hooks/use-servicios';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { cn } from '@/lib/utils';

type EntradaServicio = z.input<typeof crearServicioSchema>;

/** Paleta predefinida de colores hexadecimales para distinguir servicios en la agenda. */
export const PALETA_COLORES_SERVICIO = [
  '#2563EB',
  '#0D9488',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#9333EA',
  '#DB2777',
  '#475569',
] as const;

interface DialogoServicioProps {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  /** Cuando está presente, el diálogo opera en modo edición sobre ese servicio. */
  servicio?: Servicio | null;
  /** Código de moneda de la empresa para rotular el campo de precio (ej. `CLP`). */
  moneda: string;
}

function valoresIniciales(servicio?: Servicio | null): EntradaServicio {
  return {
    nombre: servicio?.nombre ?? '',
    descripcion: servicio?.descripcion ?? null,
    categoria: servicio?.categoria ?? null,
    duracionMinutos: servicio?.duracionMinutos ?? 30,
    margenPosteriorMinutos: servicio?.margenPosteriorMinutos ?? 0,
    precio: servicio?.precio ?? 0,
    visiblePublico: servicio?.visiblePublico ?? true,
    color: servicio?.color ?? null,
    activo: servicio?.activo ?? true,
  };
}

/**
 * Normaliza cadenas opcionales vacías a `null` antes de validar o enviar a la API,
 * evitando colisiones con `.min(1)` en `categoria` o el formato `#RRGGBB` en `color`.
 */
function textoONull(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Diálogo modal para crear o editar un servicio del catálogo.
 *
 * Valida con `crearServicioSchema` vía `zodResolver` (compartido con la API),
 * traslada errores `VALIDACION` por campo con `aplicarErroresAlFormulario` y
 * muestra errores de negocio como `409 CONFLICTO` (nombre duplicado) en un
 * aviso superior sin cerrar el diálogo.
 */
export function DialogoServicio({
  abierto,
  alCambiarAbierto,
  servicio,
  moneda,
}: DialogoServicioProps) {
  const esEdicion = Boolean(servicio);
  const crearServicio = useCrearServicio();
  const actualizarServicio = useActualizarServicio();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const nombreId = useId();
  const nombreErrorId = useId();
  const descripcionId = useId();
  const descripcionErrorId = useId();
  const categoriaId = useId();
  const categoriaErrorId = useId();
  const duracionId = useId();
  const duracionErrorId = useId();
  const margenId = useId();
  const margenErrorId = useId();
  const precioId = useId();
  const precioErrorId = useId();
  const colorId = useId();
  const colorErrorId = useId();
  const visiblePublicoId = useId();
  const activoId = useId();

  const form = useForm<EntradaServicio, unknown, CrearServicio>({
    resolver: zodResolver(crearServicioSchema),
    defaultValues: valoresIniciales(servicio),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const colorActual = useWatch({ control, name: 'color' });

  useEffect(() => {
    if (abierto) {
      reset(valoresIniciales(servicio));
    }
  }, [abierto, reset, servicio]);

  function manejarCambioAbierto(nuevoEstado: boolean) {
    setErrorGeneral(null);
    alCambiarAbierto(nuevoEstado);
  }

  async function alEnviar(datos: CrearServicio) {
    setErrorGeneral(null);

    const carga: CrearServicio = {
      ...datos,
      descripcion: textoONull(datos.descripcion),
      categoria: textoONull(datos.categoria),
      color: textoONull(datos.color),
    };

    try {
      if (servicio) {
        await actualizarServicio.mutateAsync({ id: servicio.id, datos: carga });
        toast.success(`Servicio «${carga.nombre}» actualizado`);
      } else {
        await crearServicio.mutateAsync(carga);
        toast.success(`Servicio «${carga.nombre}» creado`);
      }
      alCambiarAbierto(false);
    } catch (error) {
      if (!aplicarErroresAlFormulario(form, error)) {
        setErrorGeneral(mensajeDeError(error));
      }
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={manejarCambioAbierto}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Modifica los datos del servicio en el catálogo.'
              : 'Agrega un servicio al catálogo para agendarlo y publicarlo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-4">
          {errorGeneral ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertDescription>{errorGeneral}</AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup>
            <Field data-invalid={Boolean(errors.nombre)}>
              <FieldLabel htmlFor={nombreId}>Nombre</FieldLabel>
              <Input
                id={nombreId}
                placeholder="Ej. Corte clásico"
                aria-invalid={Boolean(errors.nombre)}
                aria-describedby={errors.nombre ? nombreErrorId : undefined}
                {...register('nombre')}
              />
              <FieldError id={nombreErrorId} errors={[errors.nombre]} />
            </Field>

            <Field data-invalid={Boolean(errors.categoria)}>
              <FieldLabel htmlFor={categoriaId}>Categoría (opcional)</FieldLabel>
              <Input
                id={categoriaId}
                placeholder="Ej. Peluquería"
                aria-invalid={Boolean(errors.categoria)}
                aria-describedby={errors.categoria ? categoriaErrorId : undefined}
                {...register('categoria', { setValueAs: textoONull })}
              />
              <FieldError id={categoriaErrorId} errors={[errors.categoria]} />
            </Field>

            <Field data-invalid={Boolean(errors.descripcion)}>
              <FieldLabel htmlFor={descripcionId}>Descripción (opcional)</FieldLabel>
              <Textarea
                id={descripcionId}
                rows={3}
                placeholder="Describe brevemente qué incluye el servicio."
                aria-invalid={Boolean(errors.descripcion)}
                aria-describedby={errors.descripcion ? descripcionErrorId : undefined}
                {...register('descripcion', { setValueAs: textoONull })}
              />
              <FieldError id={descripcionErrorId} errors={[errors.descripcion]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={Boolean(errors.duracionMinutos)}>
                <FieldLabel htmlFor={duracionId}>Duración (min)</FieldLabel>
                <Input
                  id={duracionId}
                  type="number"
                  min={1}
                  max={1440}
                  aria-invalid={Boolean(errors.duracionMinutos)}
                  aria-describedby={errors.duracionMinutos ? duracionErrorId : undefined}
                  {...register('duracionMinutos', { valueAsNumber: true })}
                />
                <FieldError id={duracionErrorId} errors={[errors.duracionMinutos]} />
              </Field>

              <Field data-invalid={Boolean(errors.margenPosteriorMinutos)}>
                <FieldLabel htmlFor={margenId}>Margen post. (min)</FieldLabel>
                <Input
                  id={margenId}
                  type="number"
                  min={0}
                  max={480}
                  aria-invalid={Boolean(errors.margenPosteriorMinutos)}
                  aria-describedby={errors.margenPosteriorMinutos ? margenErrorId : undefined}
                  {...register('margenPosteriorMinutos', { valueAsNumber: true })}
                />
                <FieldError id={margenErrorId} errors={[errors.margenPosteriorMinutos]} />
              </Field>

              <Field data-invalid={Boolean(errors.precio)}>
                <FieldLabel htmlFor={precioId}>Precio ({moneda})</FieldLabel>
                <Input
                  id={precioId}
                  type="number"
                  min={0}
                  aria-invalid={Boolean(errors.precio)}
                  aria-describedby={errors.precio ? precioErrorId : undefined}
                  {...register('precio', { valueAsNumber: true })}
                />
                <FieldError id={precioErrorId} errors={[errors.precio]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.color)}>
              <FieldLabel htmlFor={colorId}>Color en agenda (opcional)</FieldLabel>
              <div className="space-y-2">
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Paleta de colores"
                >
                  {PALETA_COLORES_SERVICIO.map((hex) => {
                    const seleccionado = colorActual?.toUpperCase() === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Seleccionar color ${hex}`}
                        aria-pressed={seleccionado}
                        onClick={() => setValue('color', hex, { shouldValidate: true })}
                        className={cn(
                          'size-7 rounded-full border transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          seleccionado ? 'ring-2 ring-foreground ring-offset-2' : 'border-border',
                        )}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                  {colorActual ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar color"
                      onClick={() => setValue('color', null, { shouldValidate: true })}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="border-border bg-muted size-6 shrink-0 rounded-md border"
                    style={
                      colorActual && /^#[0-9A-Fa-f]{6}$/.test(colorActual)
                        ? { backgroundColor: colorActual }
                        : undefined
                    }
                  />
                  <Input
                    id={colorId}
                    placeholder="#2563EB"
                    maxLength={7}
                    aria-invalid={Boolean(errors.color)}
                    aria-describedby={errors.color ? colorErrorId : undefined}
                    {...register('color', { setValueAs: textoONull })}
                  />
                </div>
              </div>
              <FieldError id={colorErrorId} errors={[errors.color]} />
            </Field>

            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FieldLabel htmlFor={visiblePublicoId} className="cursor-pointer">
                    Visible al público
                  </FieldLabel>
                  <p className="text-muted-foreground text-xs">
                    Aparece en la página de reservas en línea.
                  </p>
                </div>
                <Controller
                  name="visiblePublico"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id={visiblePublicoId}
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FieldLabel htmlFor={activoId} className="cursor-pointer">
                    Servicio activo
                  </FieldLabel>
                  <p className="text-muted-foreground text-xs">Disponible para nuevas reservas.</p>
                </div>
                <Controller
                  name="activo"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id={activoId}
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => manejarCambioAbierto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Guardando...
                </>
              ) : esEdicion ? (
                'Guardar cambios'
              ) : (
                'Crear servicio'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
