'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmpresa } from '@/hooks/use-empresa';
import { mensajeDeError } from '@/lib/api/errores';
import { FormularioConfiguracion } from './formulario-configuracion';

/**
 * Vista principal del módulo de configuración de la empresa (`/panel/configuracion`).
 *
 * Gestiona los estados de carga (`Skeleton`), error con reintento y el
 * formulario de perfil y políticas de reserva una vez cargados los datos.
 */
export function ConfiguracionEmpresa() {
  const { data: empresa, isPending, isError, error, refetch } = useEmpresa();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">
          Administra el perfil público de tu empresa y las políticas de reserva.
        </p>
      </div>

      {isPending ? (
        <div className="space-y-6" aria-busy="true" aria-label="Cargando configuración">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, indice) => (
                <div key={indice} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, indice) => (
                <div key={indice} className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>No pudimos cargar la configuración</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{mensajeDeError(error)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="w-fit"
            >
              <RotateCcw aria-hidden />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {empresa ? <FormularioConfiguracion empresa={empresa} /> : null}
    </div>
  );
}
