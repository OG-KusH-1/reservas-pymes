import { randomBytes, randomUUID } from 'node:crypto';
import type { RolMiembro } from '@portfolio/contracts';
import { COOKIE_SESION } from '../src/app.setup.js';
import { hashTokenSesion } from '../src/auth/session.service.js';
import type { Database } from '../src/db/client.js';
import {
  clientes,
  empresas,
  miembros,
  profesionales,
  reservas,
  servicios,
  sesiones,
  usuarios,
} from '../src/db/schema.js';
import type { AppDePrueba } from './app.js';

/**
 * Fábricas de datos para pruebas de integración.
 *
 * Cada fábrica inserta una fila válida con valores por defecto razonables y
 * acepta un objeto parcial para sobrescribir lo que le interesa a la prueba.
 * Así la prueba solo menciona los datos relevantes para lo que verifica.
 *
 * Los campos únicos (slug, correo) incluyen un sufijo aleatorio para que se
 * puedan crear varias filas sin chocar.
 *
 * Al agregar una tabla al esquema, suma aquí su fábrica.
 */

type Insercion<T extends { $inferInsert: unknown }> = T['$inferInsert'];

const sufijo = () => randomUUID().slice(0, 8);

function primera<T>(filas: T[]): T {
  const fila = filas[0];
  if (!fila) throw new Error('La inserción no devolvió filas');
  return fila;
}

export async function crearEmpresa(db: Database, datos: Partial<Insercion<typeof empresas>> = {}) {
  const id = sufijo();
  return primera(
    await db
      .insert(empresas)
      .values({ nombre: `Empresa ${id}`, slug: `empresa-${id}`, ...datos })
      .returning(),
  );
}

/**
 * Crea un usuario. `passwordHash` es un marcador, no un hash real: las pruebas
 * que necesiten iniciar sesión deben generar el hash con el servicio de
 * autenticación y pasarlo en `datos`.
 */
export async function crearUsuario(db: Database, datos: Partial<Insercion<typeof usuarios>> = {}) {
  const id = sufijo();
  return primera(
    await db
      .insert(usuarios)
      .values({
        email: `usuario-${id}@example.com`,
        nombre: `Usuario ${id}`,
        passwordHash: 'hash-de-prueba',
        ...datos,
      })
      .returning(),
  );
}

export async function crearMiembro(
  db: Database,
  datos: Pick<Insercion<typeof miembros>, 'empresaId' | 'usuarioId'> &
    Partial<Insercion<typeof miembros>>,
) {
  return primera(
    await db
      .insert(miembros)
      .values({ rol: 'dueno', ...datos })
      .returning(),
  );
}

export async function crearServicio(
  db: Database,
  datos: Pick<Insercion<typeof servicios>, 'empresaId'> & Partial<Insercion<typeof servicios>>,
) {
  return primera(
    await db
      .insert(servicios)
      .values({ nombre: `Servicio ${sufijo()}`, duracionMinutos: 30, precio: 10000, ...datos })
      .returning(),
  );
}

export async function crearProfesional(
  db: Database,
  datos: Pick<Insercion<typeof profesionales>, 'empresaId'> &
    Partial<Insercion<typeof profesionales>>,
) {
  return primera(
    await db
      .insert(profesionales)
      .values({ nombre: `Profesional ${sufijo()}`, ...datos })
      .returning(),
  );
}

export async function crearCliente(
  db: Database,
  datos: Pick<Insercion<typeof clientes>, 'empresaId'> & Partial<Insercion<typeof clientes>>,
) {
  const id = sufijo();
  return primera(
    await db
      .insert(clientes)
      .values({ nombre: `Cliente ${id}`, email: `cliente-${id}@example.com`, ...datos })
      .returning(),
  );
}

/**
 * Crea una reserva de 30 minutos. Si no se indica `bloqueoHasta`, coincide con
 * el fin de la atención (servicio sin margen posterior).
 */
export async function crearReserva(
  db: Database,
  datos: Pick<
    Insercion<typeof reservas>,
    'empresaId' | 'servicioId' | 'profesionalId' | 'clienteId' | 'fechaHoraInicio'
  > &
    Partial<Insercion<typeof reservas>>,
) {
  const fin = datos.fechaHoraFin ?? new Date(datos.fechaHoraInicio.getTime() + 30 * 60_000);
  return primera(
    await db
      .insert(reservas)
      .values({
        estado: 'confirmada',
        origen: 'panel',
        precio: 10000,
        duracionMinutos: 30,
        ...datos,
        fechaHoraFin: fin,
        bloqueoHasta: datos.bloqueoHasta ?? fin,
      })
      .returning(),
  );
}

/**
 * Crea empresa, usuario, membresía y sesión directamente en la base de datos
 * para autenticar peticiones en pruebas sin consumir el límite de intentos de
 * los endpoints de autenticación.
 */
export async function crearSesionDePrueba(
  prueba: Pick<AppDePrueba, 'db'>,
  opciones: { rol?: RolMiembro } = {},
) {
  const empresa = await crearEmpresa(prueba.db);
  const usuario = await crearUsuario(prueba.db);
  await crearMiembro(prueba.db, {
    empresaId: empresa.id,
    usuarioId: usuario.id,
    rol: opciones.rol ?? 'dueno',
  });

  const token = randomBytes(32).toString('base64url');
  await prueba.db.insert(sesiones).values({
    usuarioId: usuario.id,
    empresaId: empresa.id,
    tokenHash: hashTokenSesion(token),
    expiraEn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    empresa,
    usuario,
    cookie: `${COOKIE_SESION}=${token}`,
  };
}
