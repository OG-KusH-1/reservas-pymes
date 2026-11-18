'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  crearProfesionalSchema,
  type ActualizarProfesional,
  type CrearProfesional,
  type Profesional,
} from '@portfolio/contracts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { useActualizarProfesional, useCrearProfesional } from '@/hooks/use-profesionales';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';

type EntradaFormularioProfesional = z.input<typeof crearProfesionalSchema>;

/** Normaliza cadenas opcionales vacías a `null` antes de validar con Zod. */
function normalizarOpcional(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function FormularioProfesional({
  profesional,
  cargandoExterno,
  alCambiarCargando,
  alCerrar,
}: {
  profesional: Profesional | null;
  cargandoExterno: boolean;
  alCambiarCargando: (cargando: boolean) => void;
  alCerrar: () => void;
}) {
  const esEdicion = Boolean(profesional);
  const crearProfesional = useCrearProfesional();
  const actualizarProfesional = useActualizarProfesional();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const nombreId = useId();
  const nombreErrorId = useId();
  const emailId = useId();
  const emailErrorId = useId();
  const telefonoId = useId();
  const telefonoErrorId = useId();
  const activoId = useId();

  const form = useForm<EntradaFormularioProfesional, unknown, CrearProfesional>({
    resolver: zodResolver(crearProfesionalSchema),
    defaultValues: {
      nombre: profesional?.nombre ?? '',
      email: profesional?.email ?? null,
      telefono: profesional?.telefono ?? null,
      activo: profesional?.activo ?? true,
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const cargando =
    cargandoExterno ||
    isSubmitting ||
    crearProfesional.isPending ||
    actualizarProfesional.isPending;

  async function alEnviar(datos: CrearProfesional) {
    setErrorGeneral(null);
    alCambiarCargando(true);
    const cargaLimpia: CrearProfesional = {
      nombre: datos.nombre.trim(),
      email: normalizarOpcional(datos.email),
      telefono: normalizarOpcional(datos.telefono),
      activo: datos.activo,
    };

    try {
      if (profesional) {
        const actualizado = await actualizarProfesional.mutateAsync({
          id: profesional.id,
          datos: cargaLimpia satisfies ActualizarProfesional,
        });
        toast.success(`${actualizado.nombre} fue actualizado`);
      } else {
        const creado = await crearProfesional.mutateAsync(cargaLimpia);
        toast.success(`${creado.nombre} fue agregado al equipo de profesionales`);
      }
      alCerrar();
    } catch (error) {
      if (!aplicarErroresAlFormulario(form, error)) {
        setErrorGeneral(mensajeDeError(error));
      }
    } finally {
      alCambiarCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-4">
      {errorGeneral ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{errorGeneral}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(errors.nombre)}>
          <FieldLabel htmlFor={nombreId}>Nombre completo</FieldLabel>
          <Input
            id={nombreId}
            placeholder="Ej. Valentina Soto"
            aria-invalid={Boolean(errors.nombre)}
            aria-describedby={errors.nombre ? nombreErrorId : undefined}
            {...register('nombre')}
          />
          <FieldError id={nombreErrorId} errors={[errors.nombre]} />
        </Field>

        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor={emailId}>Correo electrónico (opcional)</FieldLabel>
          <Input
            id={emailId}
            type="email"
            placeholder="valentina@estudio.cl"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? emailErrorId : undefined}
            {...register('email', { setValueAs: normalizarOpcional })}
          />
          <FieldError id={emailErrorId} errors={[errors.email]} />
        </Field>

        <Field data-invalid={Boolean(errors.telefono)}>
          <FieldLabel htmlFor={telefonoId}>Teléfono (opcional)</FieldLabel>
          <Input
            id={telefonoId}
            type="tel"
            placeholder="+56 9 1234 5678"
            aria-invalid={Boolean(errors.telefono)}
            aria-describedby={errors.telefono ? telefonoErrorId : undefined}
            {...register('telefono', { setValueAs: normalizarOpcional })}
          />
          <FieldError id={telefonoErrorId} errors={[errors.telefono]} />
        </Field>

        <Field orientation="horizontal" className="items-center justify-between">
          <div className="space-y-0.5">
            <FieldLabel htmlFor={activoId}>Profesional activo</FieldLabel>
            <p className="text-muted-foreground text-xs">
              Solo los profesionales activos pueden recibir nuevas citas.
            </p>
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
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={cargando} onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={cargando}>
          {cargando ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Guardando…
            </>
          ) : esEdicion ? (
            'Guardar cambios'
          ) : (
            'Crear profesional'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Diálogo modal para registrar un nuevo profesional o editar uno existente.
 *
 * Reutiliza `crearProfesionalSchema` para validar en cliente y traslada los
 * errores de servidor por campo mediante `aplicarErroresAlFormulario`. Los
 * campos opcionales `email` y `telefono` se normalizan a `null` cuando quedan
 * vacíos para respetar `correoSchema`.
 */
export function DialogoProfesional({
  abierto,
  profesional,
  alCerrar,
}: {
  abierto: boolean;
  profesional: Profesional | null;
  alCerrar: () => void;
}) {
  const esEdicion = Boolean(profesional);
  const [cargando, setCargando] = useState(false);

  return (
    <Dialog
      open={abierto}
      onOpenChange={(nuevoEstado) => {
        if (!nuevoEstado && !cargando) alCerrar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar profesional' : 'Nuevo profesional'}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Actualiza los datos de contacto y la disponibilidad del profesional.'
              : 'Registra a un profesional que atenderá citas en la agenda.'}
          </DialogDescription>
        </DialogHeader>

        {abierto ? (
          <FormularioProfesional
            key={profesional?.id ?? 'nuevo'}
            profesional={profesional}
            cargandoExterno={cargando}
            alCambiarCargando={setCargando}
            alCerrar={alCerrar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
