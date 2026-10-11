import type { MailMessage } from '@/infrastructure/mailer/mailer.types';
import type { SmsMessage } from '@/infrastructure/sms/sms.types';

export type MailJobData = MailMessage & { dispatchId?: string };
export type SmsJobData = SmsMessage;
export type NotificationJobData = { notificationId: string };
export type AttorneyImportJobData = {
  trigger: 'scheduled' | 'manual';
};
export type HazardExpireJobData = {
  trigger: 'scheduled';
};
