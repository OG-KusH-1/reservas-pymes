import { Inject, Injectable } from '@nestjs/common';
import type { IniciarSesion, Registro, Sesion } from '@portfolio/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception.js';
import type { Database } from '../db/client.js';
import { DRIZZLE } from '../db/database.module.js';
import { empresas, miembros, usuarios } from '../db/schema.js';
import { PasswordService } from './password.service.js';
import { SessionService, type ContextoCreacionSesion } from './session.service.js';

const PG_VIOLACION_UNICIDAD = '23505';
const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos';

export interface ResultadoAutenticacion {
  sesion: Sesion;
  token: string;
}

/**
 * Servicio de casos de uso de autenticación: registro de empresa y dueño,
 * inicio de sesión y cierre de sesión.
 *
 * **Decisión sobre enumeración de correos:**
 * - El registro (`registrar`) sí informa `409 CONFLICTO` cuando el correo ya
 *   tiene cuenta, porque de otro modo la persona no sabría por qué falla el
 *   alta; se mitiga con el límite estricto de 5 intentos por hora por IP.
 * - El inicio de sesión (`ingresar`) nunca distingue entre correo inexistente
 *   y contraseña incorrecta: siempre devuelve `401 NO_AUTENTICADO` con el
 *   mismo mensaje genérico y ejecuta una verificación contra un hash ficticio
 *   cuando el correo no existe para igualar los tiempos de respuesta.
 *
 * Ninguna contraseña, hash ni token en claro se escribe en los registros.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Registra una nueva empresa junto con su usuario dueño en una transacción
   * atómica y abre su primera sesión.
   *
   * La unicidad de correo y slug se garantiza en PostgreSQL (no con una
   * consulta previa) para evitar condiciones de carrera ante registros
   * simultáneos.
   *
   * @throws AppException (`CONFLICTO`) si el correo o el slug ya están en uso.
   */
  async registrar(
    datos: Registro,
    contexto: ContextoCreacionSesion = {},
  ): Promise<ResultadoAutenticacion> {
    const passwordHash = await this.passwordService.hash(datos.password);

    let creado: {
      empresa: typeof empresas.$inferSelect;
      usuario: typeof usuarios.$inferSelect;
    };

    try {
      creado = await this.db.transaction(async (tx) => {
        const [empresa] = await tx
          .insert(empresas)
          .values({
            nombre: datos.nombreEmpresa,
            slug: datos.slug,
          })
          .returning();

        const [usuario] = await tx
          .insert(usuarios)
          .values({
            email: datos.email,
            nombre: datos.nombre,
            passwordHash,
          })
          .returning();

        if (!empresa || !usuario) {
          throw new Error('La inserción de empresa o usuario no devolvió filas');
        }

        await tx.insert(miembros).values({
          empresaId: empresa.id,
          usuarioId: usuario.id,
          rol: 'dueno',
        });

        return { empresa, usuario };
      });
    } catch (error) {
      const restriccion = extraerRestriccionUnicidad(error);
      if (restriccion === 'usuarios_email_unique') {
        throw AppException.conflicto('Ya existe una cuenta registrada con ese correo electrónico');
      }
      if (restriccion === 'empresas_slug_unique') {
        throw AppException.conflicto('Ese identificador público ya está en uso por otra empresa');
      }
      throw error;
    }

    const token = await this.sessionService.crear(creado.usuario.id, creado.empresa.id, contexto);

    return {
      token,
      sesion: {
        usuario: {
          id: creado.usuario.id,
          nombre: creado.usuario.nombre,
          email: creado.usuario.email,
          emailVerificado: creado.usuario.emailVerificadoEn !== null,
        },
        empresa: {
          id: creado.empresa.id,
          nombre: creado.empresa.nombre,
          slug: creado.empresa.slug,
          zonaHoraria: creado.empresa.zonaHoraria,
          moneda: creado.empresa.moneda,
        },
        rol: 'dueno',
      },
    };
  }

  /**
   * Autentica a una persona por correo y contraseña y abre una sesión en su
   * empresa activa más antigua.
   *
   * @throws AppException (`NO_AUTENTICADO`) ante credenciales inválidas o cuenta/empresa inactiva.
   */
  async ingresar(
    datos: IniciarSesion,
    contexto: ContextoCreacionSesion = {},
  ): Promise<ResultadoAutenticacion> {
    const [usuario] = await this.db
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        email: usuarios.email,
        passwordHash: usuarios.passwordHash,
        emailVerificadoEn: usuarios.emailVerificadoEn,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.email, datos.email))
      .limit(1);

    if (!usuario) {
      await this.passwordService.verificarFicticio(datos.password);
      throw AppException.noAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const passwordValido = await this.passwordService.verificar(
      usuario.passwordHash,
      datos.password,
    );
    if (!passwordValido || !usuario.activo) {
      throw AppException.noAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const [membresia] = await this.db
      .select({
        rol: miembros.rol,
        empresaId: empresas.id,
        empresaNombre: empresas.nombre,
        empresaSlug: empresas.slug,
        zonaHoraria: empresas.zonaHoraria,
        moneda: empresas.moneda,
      })
      .from(miembros)
      .innerJoin(empresas, eq(miembros.empresaId, empresas.id))
      .where(
        and(
          eq(miembros.usuarioId, usuario.id),
          eq(miembros.activo, true),
          eq(empresas.activo, true),
        ),
      )
      .orderBy(asc(miembros.creadoEn))
      .limit(1);

    if (!membresia) {
      throw AppException.noAutenticado(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const token = await this.sessionService.crear(usuario.id, membresia.empresaId, contexto);

    return {
      token,
      sesion: {
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          emailVerificado: usuario.emailVerificadoEn !== null,
        },
        empresa: {
          id: membresia.empresaId,
          nombre: membresia.empresaNombre,
          slug: membresia.empresaSlug,
          zonaHoraria: membresia.zonaHoraria,
          moneda: membresia.moneda,
        },
        rol: membresia.rol,
      },
    };
  }

  /**
   * Revoca la sesión asociada al token recibido si existe. Es idempotente.
   */
  async salir(token?: string): Promise<void> {
    if (!token) {
      return;
    }
    await this.sessionService.revocar(token);
  }
}

function extraerRestriccionUnicidad(excepcion: unknown): string | undefined {
  let actual: unknown = excepcion;
  for (let nivel = 0; nivel < 5 && actual instanceof Error; nivel++) {
    if (
      actual.name === 'PostgresError' &&
      'code' in actual &&
      actual.code === PG_VIOLACION_UNICIDAD &&
      'constraint_name' in actual &&
      typeof actual.constraint_name === 'string'
    ) {
      return actual.constraint_name;
    }
    actual = actual.cause;
  }
  return undefined;
}
