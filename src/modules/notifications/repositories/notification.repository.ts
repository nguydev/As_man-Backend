import { Injectable } from '@nestjs/common';
import type {
  DeliveryChannel,
  NotificationAudience,
  Prisma,
} from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

export interface CreateNotificationInput {
  audience: NotificationAudience;
  userId?: string;
  organizationId?: string;
  title: string;
  body: string;
  channels: DeliveryChannel[];
  data?: Prisma.InputJsonValue;
  expiresAt?: Date;
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        audience: input.audience,
        userId: input.userId,
        organizationId: input.organizationId,
        title: input.title,
        body: input.body,
        channels: input.channels,
        data: input.data,
        expiresAt: input.expiresAt,
      },
    });
  }

  find(id: string) {
    return this.prisma.notification.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  listForUser(userId: string, pagination: Pagination, unreadOnly = false) {
    return prismaPaginate(
      this.prisma.notification,
      {
        where: {
          userId,
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  listForUserAndOrganization(
    userId: string,
    organizationId: string,
    pagination: Pagination,
    unreadOnly = false,
  ) {
    return prismaPaginate(
      this.prisma.notification,
      {
        where: {
          userId,
          organizationId,
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  listSystemForUser(
    userId: string,
    pagination: Pagination,
    unreadOnly = false,
  ) {
    return prismaPaginate(
      this.prisma.notification,
      {
        where: {
          userId,
          audience: 'SYSTEM',
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  markDelivered(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isDelivered: true, deliveredAt: new Date() },
    });
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markReadForOrganization(id: string, userId: string, organizationId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, organizationId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markReadForSystem(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, audience: 'SYSTEM', readAt: null },
      data: { readAt: new Date() },
    });
  }

  markUnread(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: { not: null } },
      data: { readAt: null },
    });
  }

  markUnreadForOrganization(
    id: string,
    userId: string,
    organizationId: string,
  ) {
    return this.prisma.notification.updateMany({
      where: { id, userId, organizationId, readAt: { not: null } },
      data: { readAt: null },
    });
  }

  markUnreadForSystem(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, audience: 'SYSTEM', readAt: { not: null } },
      data: { readAt: null },
    });
  }

  delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  deleteForOrganization(id: string, userId: string, organizationId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId, organizationId },
    });
  }

  deleteForSystem(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId, audience: 'SYSTEM' },
    });
  }

  deleteAllForUser(userId: string) {
    return this.prisma.notification.deleteMany({ where: { userId } });
  }

  deleteAllForUserAndOrganization(userId: string, organizationId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId, organizationId },
    });
  }

  deleteAllSystemForUser(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId, audience: 'SYSTEM' },
    });
  }

  activeSystemRecipients() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        isDeleted: false,
        OR: [{ role: 'ADMIN' }, { maintainer: { isNot: null } }],
      },
      select: { id: true },
    });
  }

  activeOrganizationRecipients(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'PROVIDER'] },
        organization: { status: 'ACTIVE' },
        user: { status: 'ACTIVE', isDeleted: false },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
  }

  activeDriverRecipients(organizationIds: string[]) {
    if (organizationIds.length === 0) return Promise.resolve([]);
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId: { in: organizationIds },
        status: 'ACTIVE',
        role: 'DRIVER',
        organization: { status: 'ACTIVE' },
        driver: { status: 'ACTIVE' },
        user: { status: 'ACTIVE', isDeleted: false },
      },
      distinct: ['userId'],
      select: { userId: true },
    });
  }

  activeUser(id: string) {
    return this.prisma.user.findFirst({
      where: { id, status: 'ACTIVE', isDeleted: false },
      select: { id: true },
    });
  }

  existingUser(id: string) {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      select: { id: true },
    });
  }
}
