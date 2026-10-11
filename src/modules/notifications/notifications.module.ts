import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { FcmTokenModule } from '@/core/fcm-token/fcm-token.module';
import { NOTIFICATION_QUEUE } from '@/infrastructure/queue/queue.constants';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { AdminNotificationsController } from '@/modules/notifications/admin-notifications.controller';
import { NotificationsController } from '@/modules/notifications/notifications.controller';
import { OrganizationNotificationsController } from '@/modules/notifications/organization-notifications.controller';
import { NotificationProcessor } from '@/modules/notifications/processors/notification.processor';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';
import { NotificationService } from '@/modules/notifications/services/notification.service';

@Module({
  imports: [
    FcmTokenModule,
    forwardRef(() => MembershipsModule),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [
    NotificationsController,
    AdminNotificationsController,
    OrganizationNotificationsController,
  ],
  providers: [
    NotificationRepository,
    NotificationService,
    NotificationProcessor,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
