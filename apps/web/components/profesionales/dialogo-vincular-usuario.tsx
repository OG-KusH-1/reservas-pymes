'use client';

import type { Miembro, Profesional } from '@portfolio/contracts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useVincularUsuarioProfesional } from '@/hooks/use-profesionales';
import { esApiError, mensajeDeError } from '@/lib/api/errores';

const VALOR_SIN_CUENTA = '__ninguno__';

function ContenidoVincularUsuario({
  profesional,
  miembros,
  cargandoMiembros,
  alCambiarCargando,
  alCerrar,
}: {
  profesional: Profesional;
  miembros: Miembro[];
  cargandoMiembros: boolean;
  alCambiarCargando: (cargando: boolean) => void;
  alCerrar: () => void;
}) {
  const vincularUsuario = useVincularUsuarioProfesional();
  const [valorSeleccionado, setValorSeleccionado] = useState<string>(
    () => profesional.usuarioId ?? VALOR_SIN_CUENTA,
  );
  const [errorConflicto, setErrorConflicto] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const selectId = useId();

  async function manejarGuardar() {
    setErrorConflicto(null);
    setErrorGeneral(null);
    alCambiarCargando(true);

    const usuarioId = valorSeleccionado === VALOR_SIN_CUENTA ? null : valorSeleccionado;

    try {
      await vincularUsuario.mutateAsync({
        id: profesional.id,
        datos: { usuarioId },
      });
      toast.success(
        usuarioId
          ? `Cuenta vinculada a ${profesional.nombre}`
          : `${profesional.nombre} quedó sin cuenta vinculada`,
      );
      alCerrar();
    } catch (error) {
      if (esApiError(error, 'CONFLICTO')) {
        setErrorConflicto(error.message);
        return;
      }
      setErrorGeneral(mensajeDeError(error));
    } finally {
      alCambiarCargando(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {errorConflicto ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertTitle>No se pudo vincular la cuenta</AlertTitle>
            <AlertDescription>{errorConflicto}</AlertDescription>
          </Alert>
        ) : null}

        {errorGeneral ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{errorGeneral}</AlertDescription>
          </Alert>
        ) : null}

        {cargandoMiembros ? (
          <Skeleton className="h-9 w-full" aria-label="Cargando miembros del equipo" />
        ) : (
          <div className="space-y-2">
            <Label htmlFor={selectId}>Cuenta miembro</Label>
            <Select value={valorSeleccionado} onValueChange={setValorSeleccionado}>
              <SelectTrigger id={selectId} aria-label="Cuenta miembro a vincular">
                <SelectValue placeholder="Selecciona un miembro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VALOR_SIN_CUENTA}>Sin cuenta vinculada</SelectItem>
                {miembros.map((miembro) => (
                  <SelectItem key={miembro.usuarioId} value={miembro.usuarioId}>
                    {miembro.nombre} ({miembro.email}){!miembro.activo ? ' — Inactivo' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={vincularUsuario.isPending}
          onClick={alCerrar}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={vincularUsuario.isPending || cargandoMiembros}
          onClick={() => {
            void manejarGuardar();
          }}
        >
          {vincularUsuario.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            'Guardar vínculo'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Diálogo para vincular o desvincular un profesional con una cuenta miembro del
 * equipo (`PUT /profesionales/:id/usuario`).
 *
 * Incluye la opción «Sin cuenta vinculada» (`null`) y resalta el error
 * `409 CONFLICTO` cuando el usuario elegido ya está asociado a otro profesional.
 */
export function DialogoVincularUsuario({
  profesional,
  miembros,
  cargandoMiembros,
  alCerrar,
}: {
  profesional: Profesional | null;
  miembros: Miembro[];
  cargandoMiembros: boolean;
  alCerrar: () => void;
}) {
  const [cargando, setCargando] = useState(false);

  return (
    <Dialog
      open={Boolean(profesional)}
      onOpenChange={(abierto) => {
        if (!abierto && !cargando) alCerrar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular cuenta del equipo</DialogTitle>
          <DialogDescription>
            Asocia una cuenta miembro del panel con{' '}
            <strong className="text-foreground font-medium">{profesional?.nombre}</strong> para que
            pueda gestionar su propia agenda.
          </DialogDescription>
        </DialogHeader>

        {profesional ? (
          <ContenidoVincularUsuario
            key={profesional.id}
            profesional={profesional}
            miembros={miembros}
            cargandoMiembros={cargandoMiembros}
            alCambiarCargando={setCargando}
            alCerrar={alCerrar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
