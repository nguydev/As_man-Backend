import { Injectable } from '@nestjs/common';
import type { HazardStatus, HazardVoteType, Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export const HAZARD_SELECT = {
  id: true,
  type: true,
  status: true,
  lat: true,
  lon: true,
  radiusMeters: true,
  confirmCount: true,
  clearCount: true,
  organizationId: true,
  createdByDriverId: true,
  lastReportedAt: true,
  expiresAt: true,
  clearedAt: true,
} satisfies Prisma.HazardReportSelect;

export type HazardRow = Prisma.HazardReportGetPayload<{
  select: typeof HAZARD_SELECT;
}>;

@Injectable()
export class HazardRepository {
  constructor(private readonly prisma: PrismaService) {}

  driver(userId: string) {
    return this.prisma.driver.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
  }

  findOpenInRadiusBox(input: {
    organizationIds: string[];
    lat: number;
    lon: number;
    deltaLat: number;
    deltaLon: number;
  }) {
    const { organizationIds, lat, lon, deltaLat, deltaLon } = input;
    return this.prisma.hazardReport.findMany({
      where: {
        status: 'OPEN',
        type: 'POLICE_ICE',
        expiresAt: { gt: new Date() },
        lat: { gte: lat - deltaLat, lte: lat + deltaLat },
        lon: { gte: lon - deltaLon, lte: lon + deltaLon },
        OR: [
          { organizationId: { in: organizationIds } },
          {
            createdByDriver: {
              organizationMembers: {
                some: {
                  organizationId: { in: organizationIds },
                  role: 'DRIVER',
                  status: 'ACTIVE',
                },
              },
            },
          },
        ],
      },
      select: HAZARD_SELECT,
    });
  }

  listOpenInBounds(input: {
    organizationIds: string[] | null;
    bounds: { north: number; south: number; east: number; west: number };
  }) {
    const { organizationIds, bounds } = input;
    if (organizationIds?.length === 0) return Promise.resolve([]);

    return this.prisma.hazardReport.findMany({
      where: {
        status: 'OPEN',
        type: 'POLICE_ICE',
        expiresAt: { gt: new Date() },
        lat: { gte: bounds.south, lte: bounds.north },
        lon: { gte: bounds.west, lte: bounds.east },
        ...(organizationIds
          ? {
              OR: [
                { organizationId: { in: organizationIds } },
                {
                  createdByDriver: {
                    organizationMembers: {
                      some: {
                        organizationId: { in: organizationIds },
                        role: 'DRIVER',
                        status: 'ACTIVE',
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { lastReportedAt: 'desc' },
      select: HAZARD_SELECT,
    });
  }

  create(data: {
    lat: number;
    lon: number;
    organizationId: string;
    createdByDriverId: string;
    createdByUserId: string;
    expiresAt: Date;
  }) {
    return this.prisma.hazardReport.create({
      data: {
        lat: data.lat,
        lon: data.lon,
        organizationId: data.organizationId,
        createdByDriverId: data.createdByDriverId,
        createdByUserId: data.createdByUserId,
        expiresAt: data.expiresAt,
        votes: {
          create: {
            driverId: data.createdByDriverId,
            vote: 'CONFIRM',
          },
        },
      },
      select: HAZARD_SELECT,
    });
  }

  findOpen(id: string) {
    return this.prisma.hazardReport.findFirst({
      where: { id, status: 'OPEN' },
      select: HAZARD_SELECT,
    });
  }

  findVote(hazardId: string, driverId: string) {
    return this.prisma.hazardVote.findUnique({
      where: { hazardId_driverId: { hazardId, driverId } },
    });
  }

  applyVote(input: {
    hazardId: string;
    driverId: string;
    vote: HazardVoteType;
    confirmDelta: number;
    clearDelta: number;
    expiresAt?: Date;
    status: HazardStatus;
    clearedAt?: Date | null;
    clearedByDriverId?: string | null;
  }) {
    const {
      hazardId,
      driverId,
      vote,
      confirmDelta,
      clearDelta,
      expiresAt,
      status,
      clearedAt,
      clearedByDriverId,
    } = input;

    return this.prisma.$transaction(async (tx) => {
      await tx.hazardVote.upsert({
        where: { hazardId_driverId: { hazardId, driverId } },
        create: { hazardId, driverId, vote },
        update: { vote },
      });

      return tx.hazardReport.update({
        where: { id: hazardId },
        data: {
          confirmCount: { increment: confirmDelta },
          clearCount: { increment: clearDelta },
          lastReportedAt: vote === 'CONFIRM' ? new Date() : undefined,
          expiresAt,
          status,
          clearedAt: clearedAt === undefined ? undefined : clearedAt,
          clearedByDriverId:
            clearedByDriverId === undefined ? undefined : clearedByDriverId,
        },
        select: HAZARD_SELECT,
      });
    });
  }

  refreshConfirm(hazardId: string, expiresAt: Date) {
    return this.prisma.hazardReport.update({
      where: { id: hazardId },
      data: { lastReportedAt: new Date(), expiresAt },
      select: HAZARD_SELECT,
    });
  }

  expireOpen(now = new Date()) {
    return this.prisma.hazardReport.findMany({
      where: { status: 'OPEN', expiresAt: { lte: now } },
      select: HAZARD_SELECT,
    });
  }

  markExpired(ids: string[]) {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.hazardReport.updateMany({
      where: { id: { in: ids }, status: 'OPEN' },
      data: { status: 'EXPIRED' },
    });
  }
}
