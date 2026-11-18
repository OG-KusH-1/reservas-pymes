import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioIngreso } from '@/components/auth/formulario-ingreso';
import { RedirigirSiHaySesion } from '@/components/auth/redirigir-si-hay-sesion';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Ingresar' };

/** Página de inicio de sesión para acceder al panel de la empresa. */
export default function IngresarPage() {
  return (
    <>
      <RedirigirSiHaySesion />
      <Card>
        <CardHeader>
          <h1 className="font-heading text-lg leading-snug font-semibold">Ingresar</h1>
          <CardDescription>Accede a la agenda y reservas de tu empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <FormularioIngreso />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
