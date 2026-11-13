/** Archivo adjunto de un correo (por ejemplo, la invitación de calendario `.ics`). */
export interface AdjuntoCorreo {
  nombre: string;
  contenido: string | Buffer;
  /** Tipo MIME, por ejemplo `text/calendar`. */
  tipo: string;
}

export interface MensajeCorreo {
  para: string;
  asunto: string;
  html: string;
  /** Versión en texto plano. Obligatoria: mejora la entregabilidad y la accesibilidad. */
  texto: string;
  adjuntos?: AdjuntoCorreo[];
}

/**
 * Puerto de envío de correo.
 *
 * Los módulos de negocio dependen de esta clase abstracta y nunca de un
 * proveedor concreto. Hoy la implementa `SmtpMailer`; para usar la API HTTP
 * de un proveedor basta con crear otra implementación y cambiar el `useClass`
 * en `MailModule`. En las pruebas se reemplaza por un doble que guarda los
 * mensajes en memoria.
 *
 * Es una clase abstracta y no una interfaz porque Nest necesita un valor en
 * tiempo de ejecución como token de inyección.
 *
 * @example
 * constructor(private readonly mailer: Mailer) {}
 */
export abstract class Mailer {
  /**
   * Envía un correo.
   * @throws Error si el servidor de correo rechaza el mensaje o no responde.
   *   Quien llama decide si reintenta (las colas de la Fase 5 lo harán).
   */
  abstract enviar(mensaje: MensajeCorreo): Promise<void>;
}
