import type { Metadata } from 'next';
import { AceptarInvitacion } from '@/components/auth/aceptar-invitacion';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Invitación al equipo' };

/** Página pública para revisar y aceptar una invitación a una empresa. */
export default async function InvitacionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';

  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-lg leading-snug font-semibold">Invitación al equipo</h1>
        <CardDescription>Acepta la invitación para acceder al panel de la empresa.</CardDescription>
      </CardHeader>
      <CardContent>
        <AceptarInvitacion token={token} />
      </CardContent>
    </Card>
  );
}
