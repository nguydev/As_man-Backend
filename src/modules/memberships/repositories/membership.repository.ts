import { Injectable } from '@nestjs/common';
import type {
  OrganizationMember,
  OrganizationMemberRole,
} from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export type AddDriverMembershipResult =
  | { kind: 'created'; membership: OrganizationMember }
  | { kind: 'driver_not_found' }
  | { kind: 'fleet_not_found' }
  | { kind: 'subscription_required' }
  | { kind: 'driver_limit_reached' };

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isOrganizationActive(organizationId: string): Promise<boolean> {
    return Boolean(
      await this.prisma.organization.findFirst({
        where: { id: organizationId, status: 'ACTIVE' },
        select: { id: true },
      }),
    );
  }

  hasOrganizationRole(
    userId: string,
    organizationId: string,
    roles: OrganizationMemberRole[],
  ) {
    return this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: 'ACTIVE',
        role: { in: roles },
      },
    });
  }

  activeOrganizationIdsForUser(
    userId: string,
    roles: OrganizationMemberRole[],
  ) {
    return this.prisma.organizationMember.findMany({
      where: { userId, status: 'ACTIVE', role: { in: roles } },
      select: { organizationId: true },
    });
  }

  activeDriverIdsInOrganizations(organizationIds: string[]) {
    if (organizationIds.length === 0) return Promise.resolve([]);
    return this.prisma.organizationMember.findMany({
      where: {
        organizationId: { in: organizationIds },
        role: 'DRIVER',
        status: 'ACTIVE',
        driver: { status: 'ACTIVE' },
      },
      select: { driverId: true },
    });
  }

  addDriver(
    organizationId: string,
    driverId: string,
    actorId: string,
    fleetId?: string,
  ): Promise<AddDriverMembershipResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;

      const driver = await tx.driver.findFirst({
        where: { id: driverId, status: 'ACTIVE', user: { isDeleted: false } },
      });
      if (!driver) return { kind: 'driver_not_found' } as const;

      if (fleetId) {
        const fleet = await tx.fleet.findFirst({
          where: { id: fleetId, organizationId },
        });
        if (!fleet) return { kind: 'fleet_not_found' } as const;
      }

      const current = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId_role: {
            userId: driver.userId,
            organizationId,
            role: 'DRIVER',
          },
        },
      });

      if (current?.status !== 'ACTIVE') {
        const subscription = await tx.subscription.findFirst({
          where: {
            organizationId,
            status: 'ACTIVE',
            currentPeriodEnd: { gt: new Date() },
          },
          select: { plan: { select: { driverLimit: true } } },
          orderBy: { currentPeriodEnd: 'desc' },
        });
        if (!subscription) return { kind: 'subscription_required' } as const;

        const activeDrivers = await tx.organizationMember.count({
          where: { organizationId, role: 'DRIVER', status: 'ACTIVE' },
        });
        if (activeDrivers >= subscription.plan.driverLimit) {
          return { kind: 'driver_limit_reached' } as const;
        }
      }

      const membership = await tx.organizationMember.upsert({
        where: {
          userId_organizationId_role: {
            userId: driver.userId,
            organizationId,
            role: 'DRIVER',
          },
        },
        create: {
          userId: driver.userId,
          driverId,
          organizationId,
          role: 'DRIVER',
          createdById: actorId,
        },
        update: {
          driverId,
          status: 'ACTIVE',
          removedAt: null,
          createdById: actorId,
          joinedAt: new Date(),
        },
      });

      if (fleetId) {
        await tx.fleetMember.upsert({
          where: {
            fleetId_organizationMemberId: {
              fleetId,
              organizationMemberId: membership.id,
            },
          },
          create: {
            fleetId,
            organizationMemberId: membership.id,
            createdById: actorId,
          },
          update: {
            status: 'ACTIVE',
            removedAt: null,
            joinedAt: new Date(),
            createdById: actorId,
          },
        });
      }

      return { kind: 'created', membership } as const;
    });
  }

  removeDriver(membershipId: string, organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMember.findFirst({
        where: {
          id: membershipId,
          organizationId,
          role: 'DRIVER',
          status: 'ACTIVE',
        },
      });
      if (!membership?.driverId) return null;

      await tx.fleetMember.updateMany({
        where: { organizationMemberId: membershipId, status: 'ACTIVE' },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      await tx.organizationMember.update({
        where: { id: membershipId },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      return { driverId: membership.driverId, userId: membership.userId };
    });
  }

  removeDriverByDriverId(driverId: string, organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMember.findFirst({
        where: {
          driverId,
          organizationId,
          role: 'DRIVER',
          status: 'ACTIVE',
        },
      });
      if (!membership) return null;

      await tx.fleetMember.updateMany({
        where: { organizationMemberId: membership.id, status: 'ACTIVE' },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      await tx.organizationMember.update({
        where: { id: membership.id },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      return { driverId, userId: membership.userId };
    });
  }
}
