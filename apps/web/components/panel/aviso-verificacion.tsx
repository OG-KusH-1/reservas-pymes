'use client';

import { Loader2, MailWarning } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useEnviarVerificacion } from '@/hooks/use-cuenta';
import { mensajeDeError } from '@/lib/api/errores';
import { useSesionPanel } from './proveedor-sesion';

/**
 * Banner de advertencia en el panel cuando la cuenta aún no verifica su correo.
 *
 * Ofrece una acción directa para reenviar el enlace de verificación mediante
 * `useEnviarVerificacion()` y se oculta automáticamente en cuanto
 * `sesion.usuario.emailVerificado` pasa a ser `true`.
 */
export function AvisoVerificacion() {
  const sesion = useSesionPanel();
  const enviarVerificacion = useEnviarVerificacion();
  const [reenviado, setReenviado] = useState(false);

  if (sesion.usuario.emailVerificado) {
    return null;
  }

  async function manejarReenvio() {
    try {
      await enviarVerificacion.mutateAsync();
      setReenviado(true);
      toast.success('Correo de verificación enviado. Revisa tu bandeja de entrada.');
    } catch (error) {
      toast.error(mensajeDeError(error));
    }
  }

  return (
    <Alert className="mb-6">
      <MailWarning aria-hidden />
      <AlertTitle>Tu correo electrónico aún no está verificado</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Confirma <strong className="font-medium">{sesion.usuario.email}</strong> desde el enlace
          que enviamos a tu bandeja de entrada.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit shrink-0"
          disabled={enviarVerificacion.isPending}
          onClick={() => {
            void manejarReenvio();
          }}
        >
          {enviarVerificacion.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Enviando…
            </>
          ) : reenviado ? (
            'Reenviar nuevamente'
          ) : (
            'Reenviar correo de verificación'
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
