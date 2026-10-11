import { Injectable } from '@nestjs/common';
import type { Plan, Prisma, SubStatus } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

export interface AdminSubscriptionFilters {
  status?: SubStatus;
  organizationId?: string;
  planId?: string;
  search?: string;
}

export type SubscriptionRevenueSource = Prisma.SubscriptionGetPayload<{
  select: {
    plan: { select: { price: true; currency: true } };
  };
}>;

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  createPlan(data: Prisma.PlanCreateInput): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }

  listPlans(pagination: Pagination) {
    return prismaPaginate(
      this.prisma.plan,
      {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['name', 'driverLimit', 'createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  findPlan(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  revisePlan(id: string, data: Prisma.PlanUpdateInput): Promise<Plan | null> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { id } });
      if (!plan) return null;
      const active = await tx.subscription.count({
        where: { planId: id, status: 'ACTIVE' },
      });
      if (!active) return tx.plan.update({ where: { id }, data });
      await tx.plan.update({ where: { id }, data: { status: 'DEPRECATED' } });
      return tx.plan.create({
        data: {
          name: (data.name as string | undefined) ?? plan.name,
          stripePriceId:
            (data.stripePriceId as string | undefined) ?? plan.stripePriceId,
          driverLimit:
            (data.driverLimit as number | undefined) ?? plan.driverLimit,
          price: (data.price as number | undefined) ?? plan.price,
          currency: (data.currency as string | undefined) ?? plan.currency,
          supersedesId: plan.id,
        },
      });
    });
  }

  deprecatePlan(id: string) {
    return this.prisma.plan.update({
      where: { id },
      data: { status: 'DEPRECATED' },
    });
  }

  listForOrganization(organizationId: string, pagination: Pagination) {
    return prismaPaginate(
      this.prisma.subscription,
      {
        where: { organizationId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['currentPeriodEnd', 'createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  listSubscriptions(
    pagination: Pagination,
    filters: AdminSubscriptionFilters = {},
  ) {
    const where: Prisma.SubscriptionWhereInput = {
      status: filters.status,
      organizationId: filters.organizationId,
      planId: filters.planId,
      ...(filters.search && {
        OR: [
          {
            stripeSubscriptionId: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
          {
            organization: {
              name: { contains: filters.search, mode: 'insensitive' },
            },
          },
          {
            organization: {
              email: { contains: filters.search, mode: 'insensitive' },
            },
          },
          {
            plan: {
              name: { contains: filters.search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };

    return prismaPaginate(
      this.prisma.subscription,
      { where, include: { organization: true, plan: true } },
      pagination,
      {
        sortFields: ['status', 'currentPeriodEnd', 'createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  findSubscription(id: string) {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: { organization: true, plan: true },
    });
  }

  async statsSource(now = new Date()) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);

    const [currentMrr, previousMrr, activeSubscribers, newToday, churned] =
      await this.prisma.$transaction([
        this.prisma.subscription.findMany({
          where: { status: 'ACTIVE' },
          select: { plan: { select: { price: true, currency: true } } },
        }),
        this.prisma.subscription.findMany({
          where: {
            createdAt: { lt: month },
            OR: [
              { status: 'ACTIVE' },
              { status: 'CANCELED', updatedAt: { gte: month } },
            ],
          },
          select: { plan: { select: { price: true, currency: true } } },
        }),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.subscription.count({
          where: { status: 'ACTIVE', createdAt: { gte: today } },
        }),
        this.prisma.subscription.count({
          where: { status: 'CANCELED', updatedAt: { gte: month } },
        }),
      ]);

    return { currentMrr, previousMrr, activeSubscribers, newToday, churned };
  }

  cancelSubscription(id: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELED' },
      include: { organization: true, plan: true },
    });
  }

  activateSubscription(id: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: { organization: true, plan: true },
    });
  }

  async processStripeEvent(input: {
    eventId: string;
    eventType: string;
    stripeSubscriptionId?: string;
    organizationId?: string;
    planId?: string;
    status?: SubStatus;
    currentPeriodEnd?: Date;
  }): Promise<'processed' | 'duplicate'> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (
          await tx.processedStripeEvent.findUnique({
            where: { stripeEventId: input.eventId },
          })
        ) {
          return 'duplicate';
        }

        await tx.processedStripeEvent.create({
          data: { stripeEventId: input.eventId, eventType: input.eventType },
        });

        if (
          input.stripeSubscriptionId &&
          input.organizationId &&
          input.planId &&
          input.status &&
          input.currentPeriodEnd
        ) {
          await tx.subscription.upsert({
            where: { stripeSubscriptionId: input.stripeSubscriptionId },
            create: {
              stripeSubscriptionId: input.stripeSubscriptionId,
              organizationId: input.organizationId,
              planId: input.planId,
              status: input.status,
              currentPeriodEnd: input.currentPeriodEnd,
            },
            update: {
              planId: input.planId,
              status: input.status,
              currentPeriodEnd: input.currentPeriodEnd,
            },
          });
        } else if (input.stripeSubscriptionId && input.status) {
          await tx.subscription.updateMany({
            where: { stripeSubscriptionId: input.stripeSubscriptionId },
            data: { status: input.status },
          });
        }

        return 'processed';
      });
    } catch (error) {
      if (
        this.isUniqueConflict(error) &&
        (await this.prisma.processedStripeEvent.findUnique({
          where: { stripeEventId: input.eventId },
        }))
      ) {
        return 'duplicate';
      }
      throw error;
    }
  }

  // UTILS
  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
