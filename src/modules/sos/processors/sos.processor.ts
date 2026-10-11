import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SMS_PORT } from '@/infrastructure/sms/sms.constants';
import type { SmsPort } from '@/infrastructure/sms/sms.types';
import { SOS_QUEUE } from '@/infrastructure/queue/queue.constants';
import { SosRepository } from '@/modules/sos/repositories/sos.repository';
import locals from '@/locals';
@Injectable()
@Processor(SOS_QUEUE)
export class SosProcessor extends WorkerHost {
  constructor(
    private readonly sos: SosRepository,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
  ) {
    super();
  }
  async process(
    job: Job<{
      driverId: string;
      incidentId: string;
      lat?: number;
      lon?: number;
      message?: string;
    }>,
  ) {
    const contacts = await this.sos.notificationContacts(job.data.driverId);
    const text = `${locals.sos.alert_prefix}${job.data.message ? `: ${job.data.message}` : ''}${job.data.lat !== undefined ? ` (${job.data.lat}, ${job.data.lon})` : ''}`;
    if (!this.sms.isConfigured()) return;
    await Promise.allSettled(
      contacts.map((contact) =>
        this.sms.send({
          to: contact.phone,
          body: text,
        }),
      ),
    );
  }
}
