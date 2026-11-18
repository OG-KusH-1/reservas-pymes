'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useVerificarCorreo } from '@/hooks/use-cuenta';
import { mensajeDeError } from '@/lib/api/errores';
import { RUTAS } from '@/lib/rutas';

/**
 * Ejecuta la verificación del correo electrónico al montar (`/verificar`).
 *
 * Usa un `useRef` para evitar que el doble montaje de React StrictMode en
 * desarrollo dispare dos veces el consumo del token de un solo uso.
 */
export function EstadoVerificacion({ token }: { token: string }) {
  const verificar = useVerificarCorreo();
  const disparadoRef = useRef(false);
  const { mutate } = verificar;

  useEffect(() => {
    const tokenLimpio = token.trim();
    if (!tokenLimpio || disparadoRef.current) return;
    disparadoRef.current = true;
    mutate({ token: tokenLimpio });
  }, [mutate, token]);

  if (!token.trim()) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>Enlace inválido o incompleto</AlertTitle>
          <AlertDescription>
            Falta el token de verificación en la dirección. Puedes solicitar un nuevo correo desde
            el panel.
          </AlertDescription>
        </Alert>

        <Button asChild className="w-full">
          <Link href={RUTAS.ingresar}>Ir a ingresar</Link>
        </Button>
      </div>
    );
  }

  if (verificar.isError) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>No pudimos verificar tu correo</AlertTitle>
          <AlertDescription>{mensajeDeError(verificar.error)}</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href={RUTAS.panel.inicio}>Ir al panel</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={RUTAS.ingresar}>Ingresar</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (verificar.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <CheckCircle2 aria-hidden />
          <AlertTitle>Correo verificado</AlertTitle>
          <AlertDescription>
            Tu dirección de correo quedó confirmada correctamente.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href={RUTAS.panel.inicio}>Ir al panel</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={RUTAS.ingresar}>Ingresar</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
      <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />
      <p className="text-muted-foreground text-sm">Verificando tu correo electrónico…</p>
    </div>
  );
}
