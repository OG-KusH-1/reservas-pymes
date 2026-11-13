import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';
import { Mailer, type MensajeCorreo } from './mailer.js';

/**
 * Envío de correo por SMTP con Nodemailer.
 *
 * En desarrollo el servidor es Mailpit (`docker compose`), que captura los
 * mensajes y los muestra en http://localhost:8025 sin entregarlos. En
 * producción basta con apuntar las variables `SMTP_*` al proveedor elegido.
 */
@Injectable()
export class SmtpMailer extends Mailer implements OnApplicationShutdown {
  private readonly logger = new Logger(SmtpMailer.name);
  private readonly remitente: string;
  private transporte?: Transporter;

  // Se declara `ConfigService<Env, true>` (clase importada como valor) y no el
  // alias `AppConfig`: Nest resuelve la dependencia por la clase de la firma.
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
    this.remitente = config.get('MAIL_FROM', { infer: true });
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    await this.obtenerTransporte().sendMail({
      from: this.remitente,
      to: mensaje.para,
      subject: mensaje.asunto,
      html: mensaje.html,
      text: mensaje.texto,
      attachments: mensaje.adjuntos?.map((adjunto) => ({
        filename: adjunto.nombre,
        content: adjunto.contenido,
        contentType: adjunto.tipo,
      })),
    });
    // No se registra el destinatario completo: es un dato personal.
    this.logger.log({ asunto: mensaje.asunto }, 'Correo enviado');
  }

  onApplicationShutdown(): void {
    this.transporte?.close();
  }

  /**
   * El transporte se crea con el primer envío y no en el constructor, para
   * que la API (y las pruebas) arranquen aunque no haya servidor de correo.
   * `pool: true` reutiliza conexiones cuando se envían varios correos seguidos.
   */
  private obtenerTransporte(): Transporter {
    if (!this.transporte) {
      const config = this.config;
      const usuario = config.get('SMTP_USER', { infer: true });
      this.transporte = nodemailer.createTransport({
        host: config.get('SMTP_HOST', { infer: true }),
        port: config.get('SMTP_PORT', { infer: true }),
        secure: config.get('SMTP_SECURE', { infer: true }),
        pool: true,
        auth: usuario
          ? { user: usuario, pass: config.get('SMTP_PASSWORD', { infer: true }) }
          : undefined,
      });
    }
    return this.transporte;
  }
}
