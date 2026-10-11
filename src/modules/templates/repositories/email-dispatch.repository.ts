import { Injectable } from '@nestjs/common';
import type {
  EmailDispatchRecipientType,
  EmailDispatchStatus,
  Prisma,
} from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

const DISPATCH_INCLUDE = {
  template: { select: { id: true, title: true } },
  recipientUser: {
    select: {
      id: true,
      email: true,
      profile: { select: { name: true } },
    },
  },
  recipientOrganization: {
    select: { id: true, name: true, email: true },
  },
  sentBy: {
    select: {
      id: true,
      email: true,
      profile: { select: { name: true } },
    },
  },
} satisfies Prisma.EmailDispatchInclude;

export interface CreateEmailDispatchInput {
  templateId: string;
  templateTitle: string;
  recipientType: EmailDispatchRecipientType;
  recipientUserId?: string;
  recipientOrganizationId?: string;
  toEmail: string;
  subject: string;
  bodyMarkdown: string;
  bodyHtml: string;
  sentById: string;
}

@Injectable()
export class EmailDispatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateEmailDispatchInput) {
    return this.prisma.emailDispatch.create({
      data: {
        ...data,
        status: 'QUEUED',
      },
      include: DISPATCH_INCLUDE,
    });
  }

  list(
    pagination: Pagination,
    filters: {
      search?: string;
      status?: EmailDispatchStatus;
      recipientType?: EmailDispatchRecipientType;
    } = {},
  ) {
    const where: Prisma.EmailDispatchWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.recipientType && { recipientType: filters.recipientType }),
      ...(filters.search && {
        OR: [
          { toEmail: { contains: filters.search, mode: 'insensitive' } },
          { subject: { contains: filters.search, mode: 'insensitive' } },
          { templateTitle: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    return prismaPaginate(
      this.prisma.emailDispatch,
      {
        where,
        include: DISPATCH_INCLUDE,
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt', 'sentAt', 'subject', 'status'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  find(id: string) {
    return this.prisma.emailDispatch.findUnique({
      where: { id },
      include: DISPATCH_INCLUDE,
    });
  }
}
