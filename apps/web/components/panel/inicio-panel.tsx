'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RUTAS } from '@/lib/rutas';
import { ETIQUETAS_ROL, filtrarNavegacionPorRol } from './navegacion-panel';
import { useSesionPanel } from './proveedor-sesion';

/**
 * Vista de inicio del panel interno.
 *
 * Presenta el nombre de la empresa activa, el rol del usuario y tarjetas de
 * acceso rápido filtradas según los permisos de ese rol.
 */
export function InicioPanel() {
  const sesion = useSesionPanel();
  const accesos = filtrarNavegacionPorRol(sesion.rol).filter(
    (item) => item.href !== RUTAS.panel.inicio,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {sesion.usuario.nombre}</h1>
          <p className="text-muted-foreground text-sm">
            Estás administrando{' '}
            <span className="text-foreground font-medium">{sesion.empresa.nombre}</span>.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          Rol: {ETIQUETAS_ROL[sesion.rol]}
        </Badge>
      </div>

      <section aria-labelledby="titulo-accesos-rapidos" className="space-y-3">
        <h2 id="titulo-accesos-rapidos" className="text-base font-medium">
          Accesos rápidos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map((item) => {
            const Icono = item.icono;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="focus-visible:ring-ring group rounded-xl focus-visible:ring-2 focus-visible:outline-none"
              >
                <Card className="hover:border-primary/40 hover:bg-accent/30 h-full transition-colors">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                        <Icono className="size-4" aria-hidden />
                      </span>
                      <ArrowRight
                        className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                    <CardTitle className="pt-2 text-base">{item.etiqueta}</CardTitle>
                    <CardDescription>{item.descripcion}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
