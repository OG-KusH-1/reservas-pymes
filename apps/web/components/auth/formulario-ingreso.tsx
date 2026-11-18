'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { iniciarSesionSchema, type IniciarSesion } from '@portfolio/contracts';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useIniciarSesion } from '@/hooks/use-sesion';
import { esApiError, mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { RUTAS } from '@/lib/rutas';

/**
 * Comprueba si una ruta de retorno (`?siguiente=`) pertenece al mismo origen
 * que la aplicación para evitar redirecciones abiertas.
 *
 * Rechaza cualquier valor con barra invertida (`\`) y exige que empiece con `/`
 * y que `new URL(valor, origen).origin` coincida exactamente con `origen`,
 * porque los navegadores interpretan `//evil.com` y `/\evil.com` como destinos
 * externos.
 */
export function esRutaInterna(
  valor: string | null | undefined,
  origen = typeof window !== 'undefined' ? window.location.origin : '',
): valor is string {
  if (!valor || !origen || valor.includes('\\') || !valor.startsWith('/')) {
    return false;
  }

  try {
    return new URL(valor, origen).origin === origen;
  } catch {
    return false;
  }
}

/**
 * Formulario de inicio de sesión con correo y contraseña.
 *
 * Valida con `iniciarSesionSchema` en el cliente, traduce errores `NO_AUTENTICADO`
 * o inesperados a una alerta sobre el formulario y redirige al panel (o a
 * `?siguiente=` si pasa `esRutaInterna`) tras autenticarse.
 */
export function FormularioIngreso() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iniciarSesion = useIniciarSesion();

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const emailId = useId();
  const emailErrorId = useId();
  const passwordId = useId();
  const passwordErrorId = useId();

  const form = useForm<IniciarSesion>({
    resolver: zodResolver(iniciarSesionSchema),
    defaultValues: { email: '', password: '' },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const enviando = isSubmitting || iniciarSesion.isPending;

  async function alEnviar(datos: IniciarSesion) {
    setErrorGeneral(null);

    try {
      await iniciarSesion.mutateAsync(datos);
      const siguiente = searchParams.get('siguiente');
      router.replace(esRutaInterna(siguiente) ? siguiente : RUTAS.panel.inicio);
    } catch (error) {
      if (esApiError(error, 'NO_AUTENTICADO')) {
        setErrorGeneral(error.message);
        return;
      }
      if (!aplicarErroresAlFormulario(form, error)) {
        setErrorGeneral(mensajeDeError(error));
      }
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
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? passwordErrorId : undefined}
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
          <FieldError id={passwordErrorId} errors={[errors.password]} />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={enviando}>
        {enviando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Ingresando...
          </>
        ) : (
          'Ingresar'
        )}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        ¿No tienes cuenta?{' '}
        <Link
          href={RUTAS.registro}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
