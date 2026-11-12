import { db, queryClient } from './index.js';
import { empresas, servicios, profesionales, horarios, reservas } from './schema.js';

/**
 * Script de inicialización (Seed) para entorno de desarrollo.
 * 
 * Inserta datos de prueba multiempresa para validar relaciones y flujos base.
 */
async function seed() {
  console.log('🌱 Iniciando semilla de base de datos...');

  try {
    // 1. Crear Empresa demo
    const [empresa] = await db
      .insert(empresas)
      .values({
        nombre: 'Barbería & Spa El Portal',
        slug: 'barberia-el-portal',
        rut: '76.123.456-7',
        email: 'contacto@barberiaelportal.cl',
        telefono: '+56912345678',
      })
      .returning();

    console.log(`✅ Empresa creada: ${empresa.nombre} (${empresa.id})`);

    // 2. Crear Servicios
    const [servicioCorte] = await db
      .insert(servicios)
      .values({
        empresaId: empresa.id,
        nombre: 'Corte de Cabello Clásico',
        descripcion: 'Corte tradicional con lavado y peinado profesional',
        duracionMinutos: 45,
        precio: 15000,
      })
      .returning();

    console.log(`✅ Servicio creado: ${servicioCorte.nombre}`);

    // 3. Crear Profesional
    const [profesional] = await db
      .insert(profesionales)
      .values({
        empresaId: empresa.id,
        nombre: 'Carlos Estilista',
        email: 'carlos@barberiaelportal.cl',
        telefono: '+56987654321',
      })
      .returning();

    console.log(`✅ Profesional creado: ${profesional.nombre}`);

    // 4. Crear Horarios (Lunes a Viernes de 09:00 a 19:00)
    for (let dia = 1; dia <= 5; dia++) {
      await db.insert(horarios).values({
        empresaId: empresa.id,
        profesionalId: profesional.id,
        diaSemana: dia,
        horaInicio: '09:00',
        horaFin: '19:00',
      });
    }
    console.log('✅ Horarios registrados de Lunes a Viernes.');

    // 5. Crear Reserva de prueba
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() + 1);
    fechaInicio.setHours(10, 0, 0, 0);

    const fechaFin = new Date(fechaInicio);
    fechaFin.setMinutes(fechaFin.getMinutes() + servicioCorte.duracionMinutos);

    await db.insert(reservas).values({
      empresaId: empresa.id,
      servicioId: servicioCorte.id,
      profesionalId: profesional.id,
      clienteNombre: 'Juan Pérez',
      clienteEmail: 'juan.perez@example.com',
      clienteTelefono: '+56911223344',
      fechaHoraInicio: fechaInicio,
      fechaHoraFin: fechaFin,
      estado: 'confirmada',
      notas: 'Primera visita al salón',
    });

    console.log('✅ Reserva demo creada.');
    console.log('🎉 Seed completado exitosamente.');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

seed();
