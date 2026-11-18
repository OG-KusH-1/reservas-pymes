import type { Metadata } from 'next';
import { EstadoVerificacion } from '@/components/auth/estado-verificacion';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Verificar correo' };

/** Página pública para confirmar el correo electrónico mediante token. */
export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';

  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-lg leading-snug font-semibold">Verificación de correo</h1>
        <CardDescription>Confirmación de tu dirección de correo electrónico.</CardDescription>
      </CardHeader>
      <CardContent>
        <EstadoVerificacion token={token} />
      </CardContent>
    </Card>
  );
}
