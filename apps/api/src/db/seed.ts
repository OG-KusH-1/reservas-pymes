import { hash } from 'argon2';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { cargarEntorno } from '../config/load-env.js';
import { crearClientePg, crearDrizzle } from './client.js';
import {
  clientes,
  empresas,
  horarios,
  miembros,
  profesionales,
  profesionalesServicios,
  reservas,
  servicios,
  usuarios,
} from './schema.js';

/**
 * Datos de demostración para desarrollo local.
 *
 * - Es idempotente: si la empresa demo ya existe no hace nada. Para volver a
 *   crearla, ejecuta `pnpm db:seed -- --reset` (borra la empresa demo y todo
 *   lo que cuelga de ella, y la crea de nuevo).
 * - Corre en una transacción: si algo falla, no quedan datos a medias.
 * - No debe ejecutarse en producción; el script lo impide.
 *
 * Credenciales del usuario demo: el correo de `USUARIO_DEMO` y la contraseña
 * de la variable `SEED_PASSWORD` (su valor por defecto está en `config/env.ts`). Son valores
 * de prueba, sin validez fuera del entorno local.
 */
const SLUG_DEMO = 'barberia-el-portal';
const USUARIO_DEMO = 'demo@barberiaelportal.cl';

async function seed(): Promise<void> {
  const env = cargarEntorno();
  if (env.NODE_ENV === 'production') {
    throw new Error('El seed de demostración no se ejecuta en producción.');
  }

  const reiniciar = process.argv.includes('--reset');
  const cliente = crearClientePg(env.DATABASE_URL, { max: 1 });
  const db = crearDrizzle(cliente);

  try {
    await db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: empresas.id })
        .from(empresas)
        .where(eq(empresas.slug, SLUG_DEMO));

      if (existente && !reiniciar) {
        console.warn('La empresa demo ya existe. Usa "--reset" para recrearla.');
        return;
      }
      // El usuario demo se borra siempre antes de crear: puede haber quedado sin
      // empresa si esta se eliminó por otra vía, y su correo es único.
      await tx.delete(usuarios).where(eq(usuarios.email, USUARIO_DEMO));
      if (existente) {
        // Las reservas referencian servicios, profesionales y clientes con
        // `ON DELETE RESTRICT`, así que se borran antes que la empresa.
        await tx.delete(reservas).where(eq(reservas.empresaId, existente.id));
        await tx.delete(empresas).where(eq(empresas.id, existente.id));
      }

      const [empresa] = await tx
        .insert(empresas)
        .values({
          nombre: 'Barbería & Spa El Portal',
          slug: SLUG_DEMO,
          rut: '76.123.456-7',
          email: 'contacto@barberiaelportal.cl',
          telefono: '+56912345678',
          direccion: 'Av. Providencia 1234, Santiago',
          zonaHoraria: 'America/Santiago',
        })
        .returning();
      if (!empresa) throw new Error('No se pudo crear la empresa demo');

      const [dueno] = await tx
        .insert(usuarios)
        .values({
          email: USUARIO_DEMO,
          nombre: 'Daniela Dueña',
          passwordHash: await hash(env.SEED_PASSWORD),
          emailVerificadoEn: new Date(),
        })
        .returning();
      if (!dueno) throw new Error('No se pudo crear el usuario demo');

      await tx
        .insert(miembros)
        .values({ empresaId: empresa.id, usuarioId: dueno.id, rol: 'dueno' });

      const serviciosCreados = await tx
        .insert(servicios)
        .values([
          {
            empresaId: empresa.id,
            nombre: 'Corte de cabello clásico',
            descripcion: 'Corte tradicional con lavado y peinado',
            categoria: 'Cabello',
            duracionMinutos: 45,
            margenPosteriorMinutos: 5,
            precio: 15000,
            color: '#2563eb',
          },
          {
            empresaId: empresa.id,
            nombre: 'Perfilado de barba',
            categoria: 'Barba',
            duracionMinutos: 30,
            precio: 9000,
            color: '#16a34a',
          },
          {
            empresaId: empresa.id,
            nombre: 'Masaje descontracturante',
            categoria: 'Spa',
            duracionMinutos: 60,
            margenPosteriorMinutos: 15,
            precio: 28000,
            color: '#9333ea',
          },
        ])
        .returning();

      const profesionalesCreados = await tx
        .insert(profesionales)
        .values([
          { empresaId: empresa.id, nombre: 'Carlos Rojas', email: 'carlos@barberiaelportal.cl' },
          {
            empresaId: empresa.id,
            nombre: 'Valentina Soto',
            email: 'valentina@barberiaelportal.cl',
          },
        ])
        .returning();

      // Todos los profesionales atienden todos los servicios en la demo.
      await tx.insert(profesionalesServicios).values(
        profesionalesCreados.flatMap((profesional) =>
          serviciosCreados.map((servicio) => ({
            empresaId: empresa.id,
            profesionalId: profesional.id,
            servicioId: servicio.id,
          })),
        ),
      );

      // Lunes a viernes, en dos tramos para dejar libre la hora de colación.
      await tx.insert(horarios).values(
        profesionalesCreados.flatMap((profesional) =>
          [1, 2, 3, 4, 5].flatMap((diaSemana) => [
            {
              empresaId: empresa.id,
              profesionalId: profesional.id,
              diaSemana,
              horaInicio: '09:00',
              horaFin: '13:00',
            },
            {
              empresaId: empresa.id,
              profesionalId: profesional.id,
              diaSemana,
              horaInicio: '14:00',
              horaFin: '19:00',
            },
          ]),
        ),
      );

      const [clienteDemo] = await tx
        .insert(clientes)
        .values({
          empresaId: empresa.id,
          nombre: 'Juan Pérez',
          email: 'juan.perez@example.com',
          telefono: '+56911223344',
        })
        .returning();

      // Reserva de ejemplo: el próximo día hábil a las 10:00, hora de la empresa.
      const servicio = serviciosCreados[0];
      const profesional = profesionalesCreados[0];
      if (!clienteDemo || !servicio || !profesional) {
        throw new Error('Faltan datos base para la reserva demo');
      }
      let inicio = DateTime.now()
        .setZone(empresa.zonaHoraria)
        .plus({ days: 1 })
        .set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      while (inicio.weekday > 5) inicio = inicio.plus({ days: 1 });
      const fin = inicio.plus({ minutes: servicio.duracionMinutos });

      await tx.insert(reservas).values({
        empresaId: empresa.id,
        servicioId: servicio.id,
        profesionalId: profesional.id,
        clienteId: clienteDemo.id,
        fechaHoraInicio: inicio.toJSDate(),
        fechaHoraFin: fin.toJSDate(),
        bloqueoHasta: fin.plus({ minutes: servicio.margenPosteriorMinutos }).toJSDate(),
        estado: 'confirmada',
        origen: 'panel',
        precio: servicio.precio,
        duracionMinutos: servicio.duracionMinutos,
        notas: 'Primera visita',
        creadoPorId: dueno.id,
      });

      console.warn(`Empresa demo creada: /${empresa.slug} — usuario: ${USUARIO_DEMO}`);
    });
  } finally {
    await cliente.end();
  }
}

seed().catch((error: unknown) => {
  console.error('Error durante el seed:', error);
  process.exit(1);
});
