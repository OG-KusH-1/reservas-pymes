'use client';

import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalud } from '@/hooks/use-salud';
import { mensajeDeError } from '@/lib/api/errores';

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function Indicador({
  activo,
  textoSi,
  textoNo,
}: {
  activo: boolean;
  textoSi: string;
  textoNo: string;
}) {
  return (
    <Badge variant={activo ? 'secondary' : 'destructive'}>
      <span
        className={`size-1.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-current'}`}
        aria-hidden
      />
      {activo ? textoSi : textoNo}
    </Badge>
  );
}

/**
 * Tarjeta con el estado en vivo de la API y la base de datos.
 *
 * Muestra los tres estados que toda vista con datos remotos debe contemplar:
 * cargando (esqueleto), error (mensaje y reintento) y datos.
 */
export function EstadoSistema() {
  const { data, error, isPending, isFetching, refetch } = useSalud();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Estado del sistema</CardTitle>
          <CardDescription>Se actualiza automáticamente cada 15 segundos.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} aria-hidden />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando estado">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : error ? (
          <p role="alert" className="text-destructive text-sm">
            {mensajeDeError(error)}
          </p>
        ) : (
          <dl className="divide-y">
            <Fila etiqueta="API">
              <Indicador activo={data.status === 'ok'} textoSi="Operativa" textoNo="Degradada" />
            </Fila>
            <Fila etiqueta="Base de datos">
              <Indicador
                activo={data.services.database === 'connected'}
                textoSi="Conectada"
                textoNo="Sin conexión"
              />
            </Fila>
            <Fila etiqueta="Versión">
              <span className="font-mono">{data.version}</span>
            </Fila>
            <Fila etiqueta="Entorno">{data.environment}</Fila>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
