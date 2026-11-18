'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { solicitarRecuperacionSchema, type SolicitarRecuperacion } from '@portfolio/contracts';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSolicitarRecuperacion } from '@/hooks/use-cuenta';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { RUTAS } from '@/lib/rutas';

/**
 * Formulario público para solicitar la recuperación de contraseña (`/recuperar`).
 *
 * Valida el correo con `solicitarRecuperacionSchema`. Tras enviar, muestra
 * siempre una confirmación neutra sin revelar si el correo existe o no.
 */
export function FormularioRecuperar() {
  const solicitarRecuperacion = useSolicitarRecuperacion();
  const [enviado, setEnviado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const emailId = useId();
  const emailErrorId = useId();

  const form = useForm<SolicitarRecuperacion>({
    resolver: zodResolver(solicitarRecuperacionSchema),
    defaultValues: { email: '' },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const cargando = isSubmitting || solicitarRecuperacion.isPending;

  async function alEnviar(datos: SolicitarRecuperacion) {
    setErrorGeneral(null);

    try {
      await solicitarRecuperacion.mutateAsync(datos);
      setEnviado(true);
    } catch (error) {
      if (!aplicarErroresAlFormulario(form, error)) {
        setErrorGeneral(mensajeDeError(error));
      }
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <CheckCircle2 aria-hidden />
          <AlertTitle>Solicitud recibida</AlertTitle>
          <AlertDescription>
            Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu
            contraseña en los próximos minutos.
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="w-full">
          <Link href={RUTAS.ingresar}>Volver a ingresar</Link>
        </Button>
      </div>
    );
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
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={cargando}>
        {cargando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Enviando enlace…
          </>
        ) : (
          'Enviar enlace de recuperación'
        )}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        ¿Recordaste tu contraseña?{' '}
        <Link
          href={RUTAS.ingresar}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Volver a ingresar
        </Link>
      </p>
    </form>
  );
}
