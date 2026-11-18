import type { Metadata } from 'next';
import { FormularioRestablecer } from '@/components/auth/formulario-restablecer';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Restablecer contraseña' };

/** Página pública para definir una nueva contraseña usando el token de recuperación. */
export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';

  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-lg leading-snug font-semibold">Restablecer contraseña</h1>
        <CardDescription>Ingresa una nueva contraseña para tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioRestablecer token={token} />
      </CardContent>
    </Card>
  );
}
