import { BellRing, CalendarClock, Globe, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RUTAS } from '@/lib/rutas';

const BENEFICIOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    icono: Globe,
    titulo: 'Tu página de reservas',
    texto:
      'Un enlace propio donde tus clientes eligen servicio, profesional y hora, desde el celular.',
  },
  {
    icono: CalendarClock,
    titulo: 'Agenda sin topes',
    texto:
      'Horarios, colaciones y vacaciones por profesional. Una hora nunca se reserva dos veces.',
  },
  {
    icono: BellRing,
    titulo: 'Recordatorios automáticos',
    texto: 'Confirmaciones y recordatorios por correo que reducen las inasistencias.',
  },
  {
    icono: Users,
    titulo: 'Todo tu equipo',
    texto: 'Cada persona ve lo que le corresponde: dueños, recepción y profesionales.',
  },
  {
    icono: ShieldCheck,
    titulo: 'Tus datos, solo tuyos',
    texto: 'La información de cada negocio está aislada de la de los demás.',
  },
];

/** Página de inicio de la plataforma. Es estática: se genera al compilar. */
export default function InicioPage() {
  return (
    <>
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Reservas en línea para tu negocio de servicios
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          Publica tu agenda, recibe reservas las 24 horas y dedica tu tiempo a atender, no a
          coordinar horas por mensaje.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link href={RUTAS.registro}>Comenzar gratis</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href={RUTAS.ingresar}>Ya tengo cuenta</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="beneficios" className="mx-auto w-full max-w-6xl px-4 pb-24">
        <h2 id="beneficios" className="sr-only">
          Qué incluye
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
            <li key={titulo}>
              <Card className="h-full">
                <CardHeader>
                  <span className="bg-primary/10 text-primary mb-2 flex size-9 items-center justify-center rounded-lg">
                    <Icono className="size-5" aria-hidden />
                  </span>
                  <CardTitle>{titulo}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">{texto}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
