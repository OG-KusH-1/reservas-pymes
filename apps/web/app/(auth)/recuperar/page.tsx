import type { Metadata } from 'next';
import { FormularioRecuperar } from '@/components/auth/formulario-recuperar';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

/** Página pública para solicitar el enlace de recuperación de contraseña. */
export default function RecuperarPage() {
  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-lg leading-snug font-semibold">Recuperar contraseña</h1>
        <CardDescription>
          Ingresa tu correo electrónico y te enviaremos un enlace para crear una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioRecuperar />
      </CardContent>
    </Card>
  );
}
