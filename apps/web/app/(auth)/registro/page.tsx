import type { Metadata } from 'next';
import { FormularioRegistro } from '@/components/auth/formulario-registro';
import { RedirigirSiHaySesion } from '@/components/auth/redirigir-si-hay-sesion';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Crear cuenta' };

/** Página de registro para crear una empresa y la cuenta de su dueño. */
export default function RegistroPage() {
  return (
    <>
      <RedirigirSiHaySesion />
      <Card>
        <CardHeader>
          <h1 className="font-heading text-lg leading-snug font-semibold">Crear cuenta</h1>
          <CardDescription>
            Registra tu empresa y comienza a recibir reservas en línea.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioRegistro />
        </CardContent>
      </Card>
    </>
  );
}
