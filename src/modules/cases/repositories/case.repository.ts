import { Injectable } from '@nestjs/common';
import type { Case, CaseOutcome, CaseStatus, Prisma } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';
@Injectable()
export class CaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDriver(id: string) {
    return this.prisma.driver.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  create(input: {
    attorneyId: string;
    actorId: string;
    driverId: string;
    court?: string;
    hearingDate?: Date;
    summary?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.case.create({
        data: {
          attorneyId: input.attorneyId,
          driverId: input.driverId,
          court: input.court,
          hearingDate: input.hearingDate,
          summary: input.summary,
          createdById: input.actorId,
        },
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: row.id,
          fromStatus: null,
          toStatus: row.status,
          changedById: input.actorId,
          reason: 'Case created',
        },
      });

      return tx.case.findUnique({
        where: { id: row.id },
        include: {
          attorney: { include: { address: true } },
          driver: { include: { user: { include: { profile: true } } } },
          vaultDocs: { include: { fileObject: true } },
          statusHistory: { orderBy: { changedAt: 'asc' } },
        },
      });
    });
  }
  list(
    pagination: Pagination,
    filters: {
      status?: CaseStatus;
      search?: string;
      organizationId?: string;
      attorneyId?: string;
    } = {},
  ) {
    const search = filters.search?.trim();
    const where: Prisma.CaseWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.attorneyId ? { attorneyId: filters.attorneyId } : {}),
      ...(filters.organizationId
        ? {
            driver: {
              organizationMembers: {
                some: {
                  organizationId: filters.organizationId,
                  role: 'DRIVER',
                  status: 'ACTIVE',
                },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { id: { equals: search } },
              { court: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return prismaPaginate(
      this.prisma.case,
      {
        where,
        include: {
          attorney: {
            include: {
              address: true,
            },
          },
          driver: { include: { user: { include: { profile: true } } } },
          vaultDocs: true,
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

  async stats() {
    const [total, active, completed, failed, upcomingHearings] =
      await this.prisma.$transaction([
        this.prisma.case.count(),
        this.prisma.case.count({
          where: {
            status: {
              in: ['OPEN', 'IN_PROGRESS', 'HEARING', 'REOPENED'],
            },
          },
        }),
        this.prisma.case.count({
          where: { status: 'CLOSED', outcome: 'WIN' },
        }),
        this.prisma.case.count({
          where: {
            OR: [
              { status: 'CLOSED', outcome: 'LOSE' },
              { status: 'CANCELLED' },
            ],
          },
        }),
        this.prisma.case.count({
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS', 'HEARING', 'REOPENED'] },
            hearingDate: { gte: new Date() },
          },
        }),
      ]);

    return { active, completed, failed, total, upcomingHearings };
  }

  find(id: string) {
    return this.prisma.case.findUnique({
      where: { id },
      include: {
        attorney: {
          include: {
            address: true,
          },
        },
        driver: { include: { user: { include: { profile: true } } } },
        vaultDocs: { include: { fileObject: true } },
        statusHistory: {
          orderBy: { changedAt: 'asc' },
          include: {
            changedBy: { select: { id: true, email: true, profile: true } },
          },
        },
      },
    });
  }
  changeStatus(
    id: string,
    status: CaseStatus,
    actorId: string,
    outcome?: CaseOutcome | null,
    reason?: string,
  ): Promise<Case | null> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.case.findUnique({ where: { id } });
      if (!row) return null;
      const updated = await tx.case.update({
        where: { id },
        data: {
          status,
          ...(outcome !== undefined && { outcome }),
        },
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: id,
          fromStatus: row.status,
          toStatus: status,
          changedById: actorId,
          reason,
        },
      });
      return updated;
    });
  }

  update(
    id: string,
    input: {
      attorneyId?: string;
      driverId?: string;
      court?: string | null;
      hearingDate?: Date | null;
      summary?: string | null;
    },
  ) {
    return this.prisma.case.update({
      where: { id },
      data: {
        ...(input.attorneyId !== undefined && {
          attorneyId: input.attorneyId,
        }),
        ...(input.driverId !== undefined && { driverId: input.driverId }),
        ...(input.court !== undefined && { court: input.court }),
        ...(input.hearingDate !== undefined && {
          hearingDate: input.hearingDate,
        }),
        ...(input.summary !== undefined && { summary: input.summary }),
      },
      include: {
        attorney: { include: { address: true } },
        driver: { include: { user: { include: { profile: true } } } },
        vaultDocs: { include: { fileObject: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
  }
}
