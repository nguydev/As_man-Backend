import { Injectable } from '@nestjs/common';
import type { OrganizationStatus, Prisma } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

export interface CreateOrganizationInput {
  name: string;
  email?: string;
  region?: string;
  logoUrl?: string;
  address?: Prisma.AddressCreateWithoutOrganizationInput;
  ownerUserId: string;
  createdById: string;
}

type OrganizationWithAddress = Prisma.OrganizationGetPayload<{
  include: { address: true };
}>;

type OrganizationStatusTarget = Prisma.OrganizationGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    members: {
      select: {
        userId: true;
        user: { select: { id: true; email: true } };
      };
    };
  };
}>;

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  createWithOwner(
    input: CreateOrganizationInput,
  ): Promise<OrganizationWithAddress> {
    return this.prisma.organization.create({
      data: {
        name: input.name,
        email: input.email,
        region: input.region,
        logoUrl: input.logoUrl,
        createdById: input.createdById,
        address: input.address ? { create: input.address } : undefined,
        members: {
          create: {
            userId: input.ownerUserId,
            role: 'OWNER',
            createdById: input.createdById,
          },
        },
      },
      include: { address: true },
    });
  }

  update(
    id: string,
    data: Prisma.OrganizationUpdateInput,
  ): Promise<OrganizationWithAddress> {
    return this.prisma.organization.update({
      where: { id },
      data,
      include: { address: true },
    });
  }

  listAll(pagination: Pagination) {
    return prismaPaginate(
      this.prisma.organization,
      {
        include: {
          address: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          createdBy: {
            include: { profile: true },
          },
          vaultDocs: {
            include: { fileObject: true },
          },
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      },
      pagination,
      {
        sortFields: ['name', 'createdAt', 'updatedAt'],
        defaultSortField: 'name',
        defaultSortDirection: 'asc',
      },
    );
  }

  listForMember(userId: string, pagination: Pagination) {
    return prismaPaginate(
      this.prisma.organization,
      {
        where: {
          status: 'ACTIVE',
          members: {
            some: {
              userId,
              status: 'ACTIVE',
              user: { status: 'ACTIVE', isDeleted: false },
            },
          },
        },
        include: {
          address: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          createdBy: {
            include: { profile: true },
          },
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      },
      pagination,
      {
        sortFields: ['name', 'createdAt', 'updatedAt'],
        defaultSortField: 'name',
        defaultSortDirection: 'asc',
      },
    );
  }

  async stats() {
    const [totalOrgs, totalFleets, totalDrivers] =
      await this.prisma.$transaction([
        this.prisma.organization.count(),
        this.prisma.fleet.count(),
        this.prisma.driver.count({ where: { status: { not: 'DELETED' } } }),
      ]);

    return { totalFleets, totalDrivers, totalOrgs };
  }

  findById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: {
        address: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          include: { profile: true },
        },
        vaultDocs: {
          include: { fileObject: true },
        },
        _count: { select: { members: true } },
      },
    });
  }

  findStatusTarget(id: string): Promise<OrganizationStatusTarget | null> {
    return this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        members: {
          where: { role: 'OWNER', status: 'ACTIVE' },
          select: {
            userId: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
    });
  }

  updateStatus(
    id: string,
    status: OrganizationStatus,
    reason: string | null,
    approvedById?: string | null,
  ): Promise<OrganizationWithAddress> {
    return this.prisma.organization.update({
      where: { id },
      data: { status, reason, approvedById },
      include: { address: true },
    });
  }
}
