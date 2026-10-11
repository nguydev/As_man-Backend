import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { DeliveryChannel } from '@prisma-client';
import type { Job } from 'bullmq';
import { FcmTokenRepository } from '@/core/fcm-token/repositories/fcm-token.repository';
import { FirebaseService } from '@/infrastructure/firebase/firebase.service';
import { MAILER_PORT } from '@/infrastructure/mailer/mailer.constants';
import type { MailerPort } from '@/infrastructure/mailer/mailer.types';
import { NOTIFICATION_QUEUE } from '@/infrastructure/queue/queue.constants';
import type { NotificationJobData } from '@/infrastructure/queue/queue.types';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly tokens: FcmTokenRepository,
    private readonly firebase: FirebaseService,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const notification = await this.notifications.find(job.data.notificationId);
    if (!notification?.userId || notification.isDelivered) return;
    if (notification.expiresAt && notification.expiresAt <= new Date()) return;

    if (notification.channels.includes(DeliveryChannel.PUSH)) {
      await this.deliverPush(notification.userId, {
        title: notification.title,
        body: notification.body,
        data: this.pushData(notification.data),
      });
    }

    if (
      notification.channels.includes(DeliveryChannel.EMAIL) &&
      notification.user?.email
    ) {
      await this.mailer.send({
        to: notification.user.email,
        subject: notification.title,
        text: notification.body,
      });
    }

    await this.notifications.markDelivered(notification.id);
  }

  private async deliverPush(
    userId: string,
    message: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!this.firebase.isConfigured()) return;

    const tokens = await this.tokens.findActiveByUserId(userId);
    const failures = await this.firebase.sendMulticast({
      tokens: tokens.map((token) => token.token),
      ...message,
    });

    await Promise.all(
      failures.map((failure) => {
        if (this.firebase.isPermanentTokenError(failure.error)) {
          return this.tokens.invalidate(failure.token);
        }
        const token = tokens.find((token) => token.token === failure.token);
        this.logger.warn(
          `Push delivery failed for token ${token?.id ?? failure.token}`,
          failure.error instanceof Error ? failure.error.stack : undefined,
        );
        return Promise.resolve();
      }),
    );

    const transientFailure = failures.find(
      (failure) => !this.firebase.isPermanentTokenError(failure.error),
    );
    if (transientFailure) {
      throw transientFailure.error;
    }
  }

  private pushData(data: unknown): Record<string, string> | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)]),
    );
  }
}
