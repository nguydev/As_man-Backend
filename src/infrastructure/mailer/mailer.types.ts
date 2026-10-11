export interface MailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Optional audit row updated by MailProcessor after delivery. */
  dispatchId?: string;
}

export interface MailerPort {
  send(message: MailMessage): Promise<void>;
}
