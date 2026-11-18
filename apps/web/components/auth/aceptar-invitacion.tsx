'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { aceptarInvitacionSchema, passwordSchema } from '@portfolio/contracts';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ETIQUETAS_ROL } from '@/components/panel/navegacion-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAceptarInvitacion, useDetalleInvitacion } from '@/hooks/use-equipo';
import { useSesion } from '@/hooks/use-sesion';
import { mensajeDeError } from '@/lib/api/errores';
import { aplicarErroresAlFormulario } from '@/lib/api/formularios';
import { RUTAS } from '@/lib/rutas';

const crearCuentaInvitacionSchema = aceptarInvitacionSchema.extend({
  nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255),
  password: passwordSchema,
});

type CrearCuentaInvitacion = z.infer<typeof crearCuentaInvitacionSchema>;

/**
 * Pantalla pública para consultar y aceptar una invitación (`/invitacion`).
 *
 * Adapta el flujo según `usuarioExiste`:
 * - Si no existe cuenta, pide nombre y contraseña para crearla y entrar al panel.
 * - Si ya existe cuenta, permite aceptar directamente cuando la sesión activa
 *   corresponde al correo invitado, o redirige a `/ingresar?siguiente=...`.
 */
export function AceptarInvitacion({ token }: { token: string }) {
  const router = useRouter();
  const detalleQuery = useDetalleInvitacion(token);
  const sesionQuery = useSesion();
  const aceptar = useAceptarInvitacion(token);

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const nombreId = useId();
  const nombreErrorId = useId();
  const passwordId = useId();
  const passwordErrorId = useId();

  const form = useForm<CrearCuentaInvitacion>({
    resolver: zodResolver(crearCuentaInvitacionSchema),
    defaultValues: { nombre: '', password: '' },
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
          <AlertTitle>Invitación inválida o incompleta</AlertTitle>
          <AlertDescription>
            Falta el token de la invitación en la dirección. Pide a quien te invitó que te envíe el
            enlace completo.
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="w-full">
          <Link href={RUTAS.ingresar}>Ir a ingresar</Link>
        </Button>
      </div>
    );
  }

  if (detalleQuery.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando invitación">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (detalleQuery.isError) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>No pudimos cargar la invitación</AlertTitle>
          <AlertDescription>{mensajeDeError(detalleQuery.error)}</AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="w-full">
          <Link href={RUTAS.ingresar}>Ir a ingresar</Link>
        </Button>
      </div>
    );
  }

  const detalle = detalleQuery.data;
  const sesion = sesionQuery.data;
  const mismaCuentaActiva = Boolean(
    sesion && sesion.usuario.email.toLowerCase() === detalle.email.toLowerCase(),
  );
  const rutaRetorno = `${RUTAS.invitacion}?token=${encodeURIComponent(token)}`;
  const urlIngresar = `${RUTAS.ingresar}?siguiente=${encodeURIComponent(rutaRetorno)}`;

  async function manejarCrearYAceptar(datos: CrearCuentaInvitacion) {
    setErrorGeneral(null);

    try {
      await aceptar.mutateAsync(datos);
      router.replace(RUTAS.panel.inicio);
    } catch (error) {
      if (!aplicarErroresAlFormulario(form, error)) {
        setErrorGeneral(mensajeDeError(error));
      }
    }
  }

  async function manejarAceptarConSesion() {
    setErrorGeneral(null);

    try {
      await aceptar.mutateAsync({});
      router.replace(RUTAS.panel.inicio);
    } catch (error) {
      setErrorGeneral(mensajeDeError(error));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-muted/60 flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{detalle.empresaNombre}</span>
          <Badge variant="secondary">{ETIQUETAS_ROL[detalle.rol]}</Badge>
        </div>
        <span className="text-muted-foreground text-xs">{detalle.email}</span>
      </div>

      {errorGeneral ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{errorGeneral}</AlertDescription>
        </Alert>
      ) : null}

      {detalle.usuarioExiste ? (
        mismaCuentaActiva ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={aceptar.isPending}
            onClick={() => {
              void manejarAceptarConSesion();
            }}
          >
            {aceptar.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Aceptando invitación…
              </>
            ) : (
              'Aceptar invitación'
            )}
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertDescription>
                Ya existe una cuenta con <strong>{detalle.email}</strong>. Inicia sesión con ese
                correo para aceptar la invitación.
              </AlertDescription>
            </Alert>

            <Button asChild size="lg" className="w-full">
              <Link href={urlIngresar}>Iniciar sesión para aceptar</Link>
            </Button>
          </div>
        )
      ) : (
        <form
          onSubmit={handleSubmit(manejarCrearYAceptar)}
          noValidate
          className="flex flex-col gap-5"
        >
          <FieldGroup>
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

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor={passwordId}>Contraseña</FieldLabel>
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

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting || aceptar.isPending}
          >
            {isSubmitting || aceptar.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Creando cuenta…
              </>
            ) : (
              'Crear cuenta y aceptar'
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
