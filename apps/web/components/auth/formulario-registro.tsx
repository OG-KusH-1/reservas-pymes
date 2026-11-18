'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MIN, registroSchema, type Registro } from '@portfolio/contracts';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useRegistro } from '@/hooks/use-sesion';
import { esApiError, mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { RUTAS } from '@/lib/rutas';
import { sugerirSlug } from '@/lib/slug';

/**
 * Formulario de registro de empresa y cuenta del dueño.
 *
 * Sugiere el `slug` público automáticamente mientras se escribe el nombre de la
 * empresa; en cuanto la persona edita el campo `slug` a mano, deja de
 * sobrescribirse para respetar su elección.
 *
 * Traslada los errores `VALIDACION` del servidor a cada campo mediante
 * `aplicarErroresAlFormulario` y muestra los conflictos (`CONFLICTO`) u otros
 * fallos en una alerta sobre el formulario.
 */
export function FormularioRegistro() {
  const router = useRouter();
  const registro = useRegistro();

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false);

  const empresaId = useId();
  const empresaErrorId = useId();
  const slugId = useId();
  const slugDescId = useId();
  const slugErrorId = useId();
  const nombreId = useId();
  const nombreErrorId = useId();
  const emailId = useId();
  const emailErrorId = useId();
  const passwordId = useId();
  const passwordDescId = useId();
  const passwordErrorId = useId();

  const form = useForm<Registro>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      nombreEmpresa: '',
      slug: '',
      nombre: '',
      email: '',
      password: '',
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = form;

  const slugActual = useWatch({ control, name: 'slug' });
  const enviando = isSubmitting || registro.isPending;

  async function alEnviar(datos: Registro) {
    setErrorGeneral(null);

    try {
      await registro.mutateAsync(datos);
      router.replace(RUTAS.panel.inicio);
    } catch (error) {
      if (aplicarErroresAlFormulario(form, error)) {
        return;
      }
      if (esApiError(error, 'CONFLICTO')) {
        setErrorGeneral(error.message);
        return;
      }
      setErrorGeneral(mensajeDeError(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-5">
      {errorGeneral ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{errorGeneral}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(errors.nombreEmpresa)}>
          <FieldLabel htmlFor={empresaId}>Nombre de la empresa</FieldLabel>
          <Input
            id={empresaId}
            type="text"
            autoComplete="organization"
            placeholder="Peluquería Sur"
            aria-invalid={Boolean(errors.nombreEmpresa)}
            aria-describedby={errors.nombreEmpresa ? empresaErrorId : undefined}
            {...register('nombreEmpresa', {
              onChange: (evento: React.ChangeEvent<HTMLInputElement>) => {
                if (slugEditadoManualmente) return;
                setValue('slug', sugerirSlug(evento.target.value), {
                  shouldValidate: isSubmitted || Boolean(errors.slug),
                });
              },
            })}
          />
          <FieldError id={empresaErrorId} errors={[errors.nombreEmpresa]} />
        </Field>

        <Field data-invalid={Boolean(errors.slug)}>
          <FieldLabel htmlFor={slugId}>Dirección de reservas</FieldLabel>
          <Input
            id={slugId}
            type="text"
            autoComplete="off"
            placeholder="peluqueria-sur"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={errors.slug ? `${slugDescId} ${slugErrorId}` : slugDescId}
            {...register('slug', {
              onChange: () => {
                if (!slugEditadoManualmente) setSlugEditadoManualmente(true);
              },
            })}
          />
          <FieldDescription id={slugDescId}>
            Tu página pública será{' '}
            <span className="font-mono break-all">…/{slugActual || 'mi-negocio'}</span>
          </FieldDescription>
          <FieldError id={slugErrorId} errors={[errors.slug]} />
        </Field>

        <Field data-invalid={Boolean(errors.nombre)}>
          <FieldLabel htmlFor={nombreId}>Tu nombre</FieldLabel>
          <Input
            id={nombreId}
            type="text"
            autoComplete="name"
            placeholder="Camila Rojas"
            aria-invalid={Boolean(errors.nombre)}
            aria-describedby={errors.nombre ? nombreErrorId : undefined}
            {...register('nombre')}
          />
          <FieldError id={nombreErrorId} errors={[errors.nombre]} />
        </Field>

        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor={emailId}>Correo electrónico</FieldLabel>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="tu@correo.cl"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? emailErrorId : undefined}
            {...register('email')}
          />
          <FieldError id={emailErrorId} errors={[errors.email]} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor={passwordId}>Contraseña</FieldLabel>
          <div className="relative">
            <Input
              id={passwordId}
              type={mostrarPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? `${passwordDescId} ${passwordErrorId}` : passwordDescId
              }
              {...register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
              onClick={() => setMostrarPassword((visible) => !visible)}
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={mostrarPassword}
            >
              {mostrarPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
          <FieldDescription id={passwordDescId}>Mínimo {PASSWORD_MIN} caracteres.</FieldDescription>
          <FieldError id={passwordErrorId} errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        {enviando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Creando cuenta...
          </>
        ) : (
          'Crear cuenta'
        )}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link
          href={RUTAS.ingresar}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Ya tengo cuenta
        </Link>
      </p>
    </form>
  );
}
