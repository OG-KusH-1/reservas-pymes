import { Global, Module } from '@nestjs/common';
import { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp-mailer.js';

/**
 * Módulo global de correo. Expone el puerto `Mailer`; la implementación
 * concreta se elige aquí y en ningún otro lugar.
 */
@Global()
@Module({
  providers: [{ provide: Mailer, useClass: SmtpMailer }],
  exports: [Mailer],
})
export class MailModule {}
