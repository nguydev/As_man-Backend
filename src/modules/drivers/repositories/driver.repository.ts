import { Injectable } from '@nestjs/common';
import type { Driver, Prisma, User } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

const DRIVER_LIST_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      profile: { select: { name: true, avatarUrl: true } },
    },
  },
  organizationMembers: {
    where: { role: 'DRIVER' as const, status: 'ACTIVE' as const },
    select: {
      organization: { select: { id: true, name: true, region: true } },
    },
    take: 3,
  },
} satisfies Prisma.DriverInclude;

type DriverListRow = Prisma.DriverGetPayload<{
  include: typeof DRIVER_LIST_INCLUDE;
}>;

export interface CreateDriverAccountInput {
  name: string;
  email: string;
  vinNumber: string;
  licensePlate: string;
  passwordHash: string | null;
  createdById?: string;
}

export interface UpdateDriverInput {
  name?: string;
  vinNumber?: string;
  licensePlate?: string;
}

@Injectable()
export class DriverRepository {
  constructor(private readonly prisma: PrismaService) {}

  createAccount(
    input: CreateDriverAccountInput,
  ): Promise<User & { driver: Driver | null }> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        profile: { create: { name: input.name } },
        credentials: {
          create: {
            provider: 'EMAIL',
            providerId: input.email,
            passwordHash: input.passwordHash,
          },
        },
        driver: {
          create: {
            vinNumber: input.vinNumber,
            licensePlate: input.licensePlate,
            createdById: input.createdById,
          },
        },
      },
      include: { driver: true },
    });
  }

  findByUserId(userId: string) {
    return this.prisma.driver.findFirst({
      where: { userId, status: { not: 'DELETED' }, user: { isDeleted: false } },
      include: { user: { select: { email: true, profile: true } } },
    });
  }

  updateByUserId(userId: string, input: UpdateDriverInput) {
    return this.prisma.driver.update({
      where: { userId },
      data: {
        vinNumber: input.vinNumber,
        licensePlate: input.licensePlate,
        user: input.name
          ? {
              update: {
                profile: {
                  upsert: {
                    create: { name: input.name },
                    update: { name: input.name },
                  },
                },
              },
            }
          : undefined,
      },
      include: { user: { select: { email: true, profile: true } } },
    });
  }

  softDeleteByUserId(userId: string) {
    return this.prisma.driver.update({
      where: { userId },
      data: { status: 'DELETED' },
    });
  }

  async listForAdmin(
    pagination: Pagination,
    filters: { search?: string } = {},
  ) {
    const search = filters.search?.trim();
    const where: Prisma.DriverWhereInput = {
      status: { not: 'DELETED' },
      user: { isDeleted: false },
      ...(search
        ? {
            OR: [
              { vinNumber: { contains: search, mode: 'insensitive' } },
              { licensePlate: { contains: search, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    {
                      profile: {
                        name: { contains: search, mode: 'insensitive' },
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const result = await prismaPaginate(
      this.prisma.driver,
      {
        where,
        include: DRIVER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt', 'licensePlate', 'vinNumber'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );

    return {
      ...result,
      data: (result.data as DriverListRow[]).map((driver) => ({
        id: driver.id,
        userId: driver.userId,
        name: driver.user?.profile?.name ?? null,
        email: driver.user?.email ?? null,
        phone: driver.user?.phone ?? null,
        avatar: driver.user?.profile?.avatarUrl ?? null,
        vinNumber: driver.vinNumber,
        licensePlate: driver.licensePlate,
        status: driver.status,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
        organizations: (driver.organizationMembers ?? []).map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          region: m.organization.region,
        })),
      })),
    };
  }

  findByOrganizationId(organizationId: string) {
    return this.prisma.driver.findMany({
      where: {
        organizationMembers: {
          some: {
            organizationId,
            role: 'DRIVER',
            status: 'ACTIVE',
          },
        },
        status: { not: 'DELETED' },
        user: { isDeleted: false },
      },
      include: {
        user: { select: { email: true, profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByOrganizationAndId(organizationId: string, driverId: string) {
    return this.prisma.driver.findFirst({
      where: {
        id: driverId,
        organizationMembers: {
          some: {
            organizationId,
            role: 'DRIVER',
            status: 'ACTIVE',
          },
        },
        status: { not: 'DELETED' },
        user: { isDeleted: false },
      },
      include: {
        user: { select: { email: true, profile: true } },
        organizationMembers: {
          where: { organizationId, role: 'DRIVER', status: 'ACTIVE' },
          take: 1,
        },
      },
    });
  }

  updateById(driverId: string, input: UpdateDriverInput) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: {
        vinNumber: input.vinNumber,
        licensePlate: input.licensePlate,
        user: input.name
          ? {
              update: {
                profile: {
                  upsert: {
                    create: { name: input.name },
                    update: { name: input.name },
                  },
                },
              },
            }
          : undefined,
      },
      include: { user: { select: { email: true, profile: true } } },
    });
  }

  deleteAccount(userId: string) {
    return this.prisma.user.delete({ where: { id: userId } });
  }
}
