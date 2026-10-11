import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/database/prisma.service';
import { MailerService } from '@/infrastructure/mailer/mailer.service';
import { MAIL_QUEUE } from '@/infrastructure/queue/queue.constants';
import type { MailJobData } from '@/infrastructure/queue/queue.types';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    const { dispatchId, ...message } = job.data;
    try {
      await this.mailer.send(message, job.id ? `mail/${job.id}` : undefined);
      if (dispatchId) {
        await this.prisma.emailDispatch.update({
          where: { id: dispatchId },
          data: { status: 'SENT', sentAt: new Date(), error: null },
        });
      }
    } catch (error) {
      this.logger.error(
        `Mail job ${job.id} failed (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<MailJobData> | undefined, error: Error) {
    if (!job?.data.dispatchId) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    await this.prisma.emailDispatch.update({
      where: { id: job.data.dispatchId },
      data: {
        status: 'FAILED',
        error: error.message.slice(0, 2000),
      },
    });
  }
}
