'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { restablecerContrasenaSchema, type RestablecerContrasena } from '@portfolio/contracts';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useRestablecerContrasena } from '@/hooks/use-cuenta';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { RUTAS } from '@/lib/rutas';

/**
 * Formulario público para restablecer la contraseña mediante token (`/restablecer`).
 *
 * Si falta el parámetro `token`, informa que el enlace es inválido o incompleto.
 * Con token presente, valida con `restablecerContrasenaSchema` y al completar
 * ofrece acceso directo a `/ingresar`.
 */
export function FormularioRestablecer({ token }: { token: string }) {
  const restablecer = useRestablecerContrasena();
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const passwordId = useId();
  const passwordErrorId = useId();

  const form = useForm<RestablecerContrasena>({
    resolver: zodResolver(restablecerContrasenaSchema),
    defaultValues: { token, password: '' },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  if (!token.trim()) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>Enlace inválido o incompleto</AlertTitle>
          <AlertDescription>
            Falta el token de recuperación en la dirección. Solicita un nuevo enlace para
            restablecer tu contraseña.
          </AlertDescription>
        </Alert>

        <Button asChild className="w-full">
          <Link href={RUTAS.recuperar}>Solicitar nuevo enlace</Link>
        </Button>
      </div>
    );
  }

  if (completado) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <CheckCircle2 aria-hidden />
          <AlertTitle>Contraseña actualizada</AlertTitle>
          <AlertDescription>Ya puedes iniciar sesión con tu nueva contraseña.</AlertDescription>
        </Alert>

        <Button asChild size="lg" className="w-full">
          <Link href={RUTAS.ingresar}>Ir a ingresar</Link>
        </Button>
      </div>
    );
  }

  const cargando = isSubmitting || restablecer.isPending;

  async function alEnviar(datos: RestablecerContrasena) {
    setErrorGeneral(null);

    try {
      await restablecer.mutateAsync(datos);
      setCompletado(true);
    } catch (error) {
      if (!aplicarErroresAlFormulario(form, error)) {
        setErrorGeneral(mensajeDeError(error));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-5">
      <input type="hidden" {...register('token')} />

      {errorGeneral ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{errorGeneral}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor={passwordId}>Nueva contraseña</FieldLabel>
          <div className="relative">
            <Input
              id={passwordId}
              type={mostrarPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 10 caracteres"
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

      <Button type="submit" size="lg" className="w-full" disabled={cargando}>
        {cargando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Guardando contraseña…
          </>
        ) : (
          'Guardar nueva contraseña'
        )}
      </Button>
    </form>
  );
}
