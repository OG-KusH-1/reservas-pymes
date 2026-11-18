import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * Hash Argon2id ficticio usado cuando el correo no existe al iniciar sesión.
 * Permite ejecutar la misma operación criptográfica y evitar diferencias
 * apreciables en el tiempo de respuesta entre correos existentes e inexistentes.
 */
const HASH_FICTICIO =
  '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/**
 * Servicio de cifrado y verificación de contraseñas con Argon2id.
 *
 * Usa los parámetros por defecto de la librería `argon2` en su variante
 * Argon2id (resistente tanto a ataques por GPU como a canales laterales).
 * Ninguna contraseña en claro ni su hash deben llegar a los registros.
 */
@Injectable()
export class PasswordService {
  /**
   * Genera el hash Argon2id de una contraseña en claro.
   *
   * @param password Contraseña en claro validada previamente por el contrato.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  /**
   * Verifica si una contraseña en claro coincide con un hash Argon2id almacenado.
   *
   * Si el hash está corrupto o tiene un formato inesperado, devuelve `false` en
   * lugar de propagar un error interno.
   */
  async verificar(hashAlmacenado: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hashAlmacenado, password);
    } catch {
      return false;
    }
  }

  /**
   * Ejecuta una verificación contra un hash ficticio fijo cuando el correo
   * consultado no existe, igualando el costo temporal del camino fallido.
   */
  async verificarFicticio(password: string): Promise<void> {
    await this.verificar(HASH_FICTICIO, password);
  }
}
