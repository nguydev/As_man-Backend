import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryChannel, NotificationAudience } from '@prisma-client';
import type { Prisma } from '@prisma-client';
import type { Queue } from 'bullmq';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  NOTIFICATION_JOB_DELIVER,
  NOTIFICATION_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import type { NotificationJobData } from '@/infrastructure/queue/queue.types';
import type {
  CreateNotificationDto,
  CreateOrganizationNotificationDto,
} from '@/modules/notifications/dto/notification.dto';
import { NotificationRepository } from '@/modules/notifications/repositories/notification.repository';
import {
  DeliveryChannelDto,
  NotificationAudienceDto,
} from '@/modules/notifications/types/notification.types';
import locals from '@/locals';

export type NotifyPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: DeliveryChannelDto[];
  expiresAt?: string | Date;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notifications: NotificationRepository,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue<NotificationJobData>,
  ) {}

  async create(dto: CreateNotificationDto) {
    const channels = this.channels(dto.channels);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;

    if (dto.audience === NotificationAudienceDto.SYSTEM) {
      return this.createForSystem(dto);
    }

    if (dto.audience === NotificationAudienceDto.ORGANIZATION) {
      if (!dto.organizationId) {
        throw new BadRequestException(
          locals.notifications.organization_id_required,
        );
      }
      return this.createForOrganization(dto.organizationId, dto);
    }

    if (!dto.userId) {
      throw new BadRequestException(locals.notifications.user_id_required);
    }

    const user = await this.notifications.activeUser(dto.userId);
    if (!user) throw new NotFoundException(locals.notifications.user_not_found);

    const notification = await this.createOne({
      ...dto,
      audience: NotificationAudienceDto.USER,
      userId: dto.userId,
      channels,
      expiresAt,
    });

    return {
      message: locals.notifications.notification_created,
      data: notification,
    };
  }

  list(userId: string, pagination: Pagination, unreadOnly = false) {
    return this.notifications.listForUser(userId, pagination, unreadOnly);
  }

  listForOrganization(
    userId: string,
    organizationId: string,
    pagination: Pagination,
    unreadOnly = false,
  ) {
    return this.notifications.listForUserAndOrganization(
      userId,
      organizationId,
      pagination,
      unreadOnly,
    );
  }

  listForSystem(userId: string, pagination: Pagination, unreadOnly = false) {
    return this.notifications.listSystemForUser(userId, pagination, unreadOnly);
  }

  async createForSystem(dto: CreateOrganizationNotificationDto) {
    const count = await this.notifySystem({
      ...dto,
      channels: dto.channels?.length
        ? dto.channels
        : [DeliveryChannelDto.IN_APP],
    });
    return {
      message: locals.notifications.notifications_created,
      data: { count },
    };
  }

  async createForOrganization(
    organizationId: string,
    dto: CreateOrganizationNotificationDto,
  ) {
    const count = await this.notifyOrganization(organizationId, {
      ...dto,
      channels: dto.channels?.length
        ? dto.channels
        : [DeliveryChannelDto.IN_APP],
    });
    return {
      message: locals.notifications.notifications_created,
      data: { count },
    };
  }

  async notifyUser(userId: string, payload: NotifyPayload): Promise<void> {
    try {
      const user = await this.notifications.existingUser(userId);
      if (!user) return;
      await this.createOne({
        audience: NotificationAudienceDto.USER,
        userId,
        title: payload.title,
        body: payload.body,
        channels: this.channels(payload.channels, true),
        data: payload.data,
        expiresAt: this.expiresAt(payload.expiresAt),
      });
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          userId,
          title: payload.title,
        },
        'notifyUser failed',
      );
    }
  }

  async notifyOrganization(
    organizationId: string,
    payload: NotifyPayload,
  ): Promise<number> {
    try {
      const recipients =
        await this.notifications.activeOrganizationRecipients(organizationId);
      const channels = this.channels(payload.channels, true);
      const expiresAt = this.expiresAt(payload.expiresAt);
      await Promise.all(
        recipients.map((recipient) =>
          this.createOne({
            audience: NotificationAudienceDto.ORGANIZATION,
            organizationId,
            userId: recipient.userId,
            title: payload.title,
            body: payload.body,
            channels,
            data: payload.data,
            expiresAt,
          }),
        ),
      );
      return recipients.length;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          organizationId,
          title: payload.title,
        },
        'notifyOrganization failed',
      );
      return 0;
    }
  }

  async notifyOrganizationDrivers(
    organizationIds: string[],
    payload: NotifyPayload,
    excludeUserId?: string,
  ): Promise<number> {
    try {
      const recipients =
        await this.notifications.activeDriverRecipients(organizationIds);
      const userIds = [
        ...new Set(
          recipients
            .map((recipient) => recipient.userId)
            .filter((userId) => userId !== excludeUserId),
        ),
      ];
      await Promise.all(
        userIds.map((userId) => this.notifyUser(userId, payload)),
      );
      return userIds.length;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          organizationIds,
          title: payload.title,
        },
        'notifyOrganizationDrivers failed',
      );
      return 0;
    }
  }

  async notifySystem(payload: NotifyPayload): Promise<number> {
    try {
      const recipients = await this.notifications.activeSystemRecipients();
      const channels = this.channels(payload.channels, true);
      const expiresAt = this.expiresAt(payload.expiresAt);
      await Promise.all(
        recipients.map((recipient) =>
          this.createOne({
            audience: NotificationAudienceDto.SYSTEM,
            userId: recipient.id,
            title: payload.title,
            body: payload.body,
            channels,
            data: payload.data,
            expiresAt,
          }),
        ),
      );
      return recipients.length;
    } catch (error) {
      this.logger.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          title: payload.title,
        },
        'notifySystem failed',
      );
      return 0;
    }
  }

  async markRead(id: string, userId: string) {
    const result = await this.notifications.markRead(id, userId);
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_read,
      data: { read: true },
    };
  }

  async markReadForOrganization(
    id: string,
    userId: string,
    organizationId: string,
  ) {
    const result = await this.notifications.markReadForOrganization(
      id,
      userId,
      organizationId,
    );
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_read,
      data: { read: true },
    };
  }

  async markReadForSystem(id: string, userId: string) {
    const result = await this.notifications.markReadForSystem(id, userId);
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_read,
      data: { read: true },
    };
  }

  async markUnread(id: string, userId: string) {
    const result = await this.notifications.markUnread(id, userId);
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_unread,
      data: { read: false },
    };
  }

  async markUnreadForOrganization(
    id: string,
    userId: string,
    organizationId: string,
  ) {
    const result = await this.notifications.markUnreadForOrganization(
      id,
      userId,
      organizationId,
    );
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_unread,
      data: { read: false },
    };
  }

  async markUnreadForSystem(id: string, userId: string) {
    const result = await this.notifications.markUnreadForSystem(id, userId);
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_unread,
      data: { read: false },
    };
  }

  async delete(id: string, userId: string) {
    const result = await this.notifications.delete(id, userId);
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_deleted,
      data: { deleted: true },
    };
  }

  async deleteForOrganization(
    id: string,
    userId: string,
    organizationId: string,
  ) {
    const result = await this.notifications.deleteForOrganization(
      id,
      userId,
      organizationId,
    );
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_deleted,
      data: { deleted: true },
    };
  }

  async deleteForSystem(id: string, userId: string) {
    const result = await this.notifications.deleteForSystem(id, userId);
    if (result.count === 0) {
      throw new NotFoundException(locals.notifications.notification_not_found);
    }
    return {
      message: locals.notifications.notification_deleted,
      data: { deleted: true },
    };
  }

  async deleteAll(userId: string) {
    const result = await this.notifications.deleteAllForUser(userId);
    return {
      message: locals.notifications.notifications_deleted,
      data: { deleted: result.count },
    };
  }

  async deleteAllForOrganization(userId: string, organizationId: string) {
    const result = await this.notifications.deleteAllForUserAndOrganization(
      userId,
      organizationId,
    );
    return {
      message: locals.notifications.notifications_deleted,
      data: { deleted: result.count },
    };
  }

  async deleteAllForSystem(userId: string) {
    const result = await this.notifications.deleteAllSystemForUser(userId);
    return {
      message: locals.notifications.notifications_deleted,
      data: { deleted: result.count },
    };
  }

  private async createOne(input: {
    audience: NotificationAudienceDto;
    userId: string;
    organizationId?: string;
    title: string;
    body: string;
    channels: DeliveryChannel[];
    data?: Record<string, unknown>;
    expiresAt?: Date;
  }) {
    const notification = await this.notifications.create({
      audience: this.audience(input.audience),
      userId: input.userId,
      organizationId: input.organizationId,
      title: input.title,
      body: input.body,
      channels: input.channels,
      data: input.data as Prisma.InputJsonValue | undefined,
      expiresAt: input.expiresAt,
    });

    await this.queue.add(NOTIFICATION_JOB_DELIVER, {
      notificationId: notification.id,
    });

    return notification;
  }

  private channels(
    channels?: DeliveryChannelDto[],
    includePushByDefault = false,
  ): DeliveryChannel[] {
    const values = channels?.length
      ? channels
      : includePushByDefault
        ? [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH]
        : [DeliveryChannelDto.IN_APP];
    return values.map((channel) => {
      return {
        [DeliveryChannelDto.IN_APP]: DeliveryChannel.IN_APP,
        [DeliveryChannelDto.PUSH]: DeliveryChannel.PUSH,
        [DeliveryChannelDto.EMAIL]: DeliveryChannel.EMAIL,
      }[channel];
    });
  }

  private audience(audience: NotificationAudienceDto): NotificationAudience {
    return {
      [NotificationAudienceDto.USER]: NotificationAudience.USER,
      [NotificationAudienceDto.SYSTEM]: NotificationAudience.SYSTEM,
      [NotificationAudienceDto.ORGANIZATION]: NotificationAudience.ORGANIZATION,
    }[audience];
  }

  private expiresAt(value?: string | Date) {
    if (!value) return undefined;
    return value instanceof Date ? value : new Date(value);
  }
}
