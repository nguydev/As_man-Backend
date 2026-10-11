import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

const FLEET_INCLUDE = {
  _count: {
    select: {
      members: { where: { status: 'ACTIVE' as const } },
    },
  },
  members: {
    where: { status: 'ACTIVE' as const },
    include: {
      organizationMember: {
        include: {
          driver: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  profile: { select: { name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'desc' as const },
  },
} satisfies Prisma.FleetInclude;

@Injectable()
export class FleetRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrganization(organizationId: string) {
    return this.prisma.fleet.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByOrganizationAndId(organizationId: string, fleetId: string) {
    return this.prisma.fleet.findFirst({
      where: { id: fleetId, organizationId },
      include: FLEET_INCLUDE,
    });
  }

  findByOrganizationAndName(organizationId: string, name: string) {
    return this.prisma.fleet.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
  }

  create(input: {
    organizationId: string;
    name: string;
    color: string;
    createdById: string;
  }) {
    return this.prisma.fleet.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        color: input.color,
        createdById: input.createdById,
      },
      include: {
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
  }

  update(
    fleetId: string,
    data: {
      name: string;
      color: string;
    },
  ) {
    return this.prisma.fleet.update({
      where: { id: fleetId },
      data: {
        name: data.name,
        color: data.color,
      },
      include: {
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
  }

  delete(fleetId: string) {
    return this.prisma.fleet.delete({ where: { id: fleetId } });
  }

  findActiveDriverMembership(organizationId: string, driverId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        role: 'DRIVER',
        status: 'ACTIVE',
        driverId,
      },
      select: { id: true, driverId: true },
    });
  }

  assignDriver(input: {
    fleetId: string;
    organizationMemberId: string;
    createdById: string;
  }) {
    return this.prisma.fleetMember.upsert({
      where: {
        fleetId_organizationMemberId: {
          fleetId: input.fleetId,
          organizationMemberId: input.organizationMemberId,
        },
      },
      create: {
        fleetId: input.fleetId,
        organizationMemberId: input.organizationMemberId,
        createdById: input.createdById,
        status: 'ACTIVE',
        role: 'MEMBER',
      },
      update: {
        status: 'ACTIVE',
        removedAt: null,
      },
    });
  }

  removeDriver(fleetId: string, organizationMemberId: string) {
    return this.prisma.fleetMember.updateMany({
      where: {
        fleetId,
        organizationMemberId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
      },
    });
  }
}
