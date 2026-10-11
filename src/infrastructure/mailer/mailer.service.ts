import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Config } from '@/configs/environment.config';
import type {
  MailerPort,
  MailMessage,
} from '@/infrastructure/mailer/mailer.types';

@Injectable()
export class MailerService implements MailerPort {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(config: ConfigService<Config>) {
    const mail = config.get<Config['mail']>('mail');
    if (!mail) throw new Error('Mail configuration missing');
    this.resend = new Resend(mail.apiKey);
    this.from = mail.from;
  }

  async send(message: MailMessage, idempotencyKey?: string): Promise<void> {
    const content = message.html
      ? { html: message.html, text: message.text }
      : { text: message.text ?? '' };
    const { error } = await this.resend.emails.send(
      {
        from: this.from,
        to: message.to,
        subject: message.subject,
        ...content,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) throw new Error(error.message, { cause: error });
  }
}
