'use client';

import type { Profesional, Servicio } from '@portfolio/contracts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsignarServiciosProfesional } from '@/hooks/use-profesionales';
import { mensajeDeError } from '@/lib/api/errores';

function ContenidoAsignarServicios({
  profesional,
  servicios,
  cargandoServicios,
  alCambiarCargando,
  alCerrar,
}: {
  profesional: Profesional;
  servicios: Servicio[];
  cargandoServicios: boolean;
  alCambiarCargando: (cargando: boolean) => void;
  alCerrar: () => void;
}) {
  const asignarServicios = useAsignarServiciosProfesional();
  const [seleccionados, setSeleccionados] = useState<string[]>(() =>
    profesional.servicios.map((servicio) => servicio.id),
  );
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  function alternarServicio(servicioId: string, marcado: boolean) {
    setSeleccionados((previos) => {
      if (marcado) {
        return previos.includes(servicioId) ? previos : [...previos, servicioId];
      }
      return previos.filter((id) => id !== servicioId);
    });
  }

  async function manejarGuardar() {
    setErrorGeneral(null);
    alCambiarCargando(true);
    try {
      await asignarServicios.mutateAsync({
        id: profesional.id,
        datos: { servicioIds: seleccionados },
      });
      toast.success(`Servicios de ${profesional.nombre} actualizados`);
      alCerrar();
    } catch (error) {
      setErrorGeneral(mensajeDeError(error));
    } finally {
      alCambiarCargando(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {errorGeneral ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{errorGeneral}</AlertDescription>
          </Alert>
        ) : null}

        {cargandoServicios ? (
          <div className="space-y-2" aria-label="Cargando servicios disponibles">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : servicios.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Aún no hay servicios en el catálogo de la empresa.
          </p>
        ) : (
          <div
            role="group"
            aria-label="Servicios disponibles"
            className="max-h-64 space-y-2 overflow-y-auto pr-1"
          >
            {servicios.map((servicio) => {
              const checkboxId = `servicio-asignar-${servicio.id}`;
              const marcado = seleccionados.includes(servicio.id);
              return (
                <div
                  key={servicio.id}
                  className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      id={checkboxId}
                      checked={marcado}
                      onCheckedChange={(estado) => alternarServicio(servicio.id, estado === true)}
                    />
                    <Label
                      htmlFor={checkboxId}
                      className="flex min-w-0 cursor-pointer items-center gap-2 font-normal"
                    >
                      <span
                        className="bg-muted-foreground/40 size-2.5 shrink-0 rounded-full"
                        style={servicio.color ? { backgroundColor: servicio.color } : undefined}
                        aria-hidden
                      />
                      <span className="truncate">{servicio.nombre}</span>
                    </Label>
                  </div>
                  {!servicio.activo ? (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Inactivo
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={asignarServicios.isPending}
          onClick={alCerrar}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={asignarServicios.isPending || cargandoServicios || servicios.length === 0}
          onClick={() => {
            void manejarGuardar();
          }}
        >
          {asignarServicios.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            'Guardar servicios'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Diálogo para asignar o desasignar de forma múltiple los servicios que
 * atiende un profesional (`PUT /profesionales/:id/servicios`).
 *
 * Mantiene el conjunto seleccionado en estado local mientras el diálogo está
 * abierto y envía el reemplazo atómico de identificadores al guardar.
 */
export function DialogoAsignarServicios({
  profesional,
  servicios,
  cargandoServicios,
  alCerrar,
}: {
  profesional: Profesional | null;
  servicios: Servicio[];
  cargandoServicios: boolean;
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
          <DialogTitle>Asignar servicios</DialogTitle>
          <DialogDescription>
            Selecciona los servicios que atiende{' '}
            <strong className="text-foreground font-medium">{profesional?.nombre}</strong>.
          </DialogDescription>
        </DialogHeader>

        {profesional ? (
          <ContenidoAsignarServicios
            key={profesional.id}
            profesional={profesional}
            servicios={servicios}
            cargandoServicios={cargandoServicios}
            alCambiarCargando={setCargando}
            alCerrar={alCerrar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
