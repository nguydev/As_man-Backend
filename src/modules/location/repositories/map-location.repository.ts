import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { PrismaTransactionService } from '@/database/prisma-transaction.service';

export type LatestDriverLocationRow = {
  driverId: string;
  lat: Prisma.Decimal;
  lon: Prisma.Decimal;
  speed: Prisma.Decimal | null;
  heading: Prisma.Decimal | null;
  deviceTs: Date;
  receivedTs: Date;
};

export type MapAddressEntity = {
  id: string;
  name: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  latitude: string;
  longitude: string;
  city: string | null;
  state: string | null;
};

export type MapSosEntity = {
  id: string;
  driverId: string;
  status: string;
  message: string | null;
  lat: Prisma.Decimal;
  lon: Prisma.Decimal;
  createdAt: Date;
  name: string | null;
  avatarUrl: string | null;
};

export type MapHazardEntity = {
  id: string;
  status: string;
  lat: Prisma.Decimal;
  lon: Prisma.Decimal;
  confirmCount: number;
  clearCount: number;
  radiusMeters: number;
  lastReportedAt: Date;
  expiresAt: Date;
};

type MapDriverRow = {
  id: string;
  userId: string;
  licensePlate: string;
  user: {
    profile: { name: string | null; avatarUrl: string | null } | null;
  };
  organizationMembers: Array<{
    fleetMembers: Array<{
      fleet: { id: string; name: string; color: string };
    }>;
  }>;
};

@Injectable()
export class MapLocationRepository {
  constructor(private readonly transactions: PrismaTransactionService) {}

  mapViewport(input: {
    organizationIds: string[] | null;
    sosOrganizationIds: string[] | null;
    allowedDriverIds: string[] | null;
    liveDriverIds: string[];
    excludeLiveDriverIds: string[];
    bounds: { north: number; south: number; east: number; west: number };
  }) {
    const {
      organizationIds,
      sosOrganizationIds,
      allowedDriverIds,
      liveDriverIds,
      excludeLiveDriverIds,
      bounds,
    } = input;
    if (allowedDriverIds?.length === 0 && organizationIds?.length === 0) {
      return Promise.resolve({
        organizations: [] as MapAddressEntity[],
        attorneys: [] as MapAddressEntity[],
        historyRows: [] as LatestDriverLocationRow[],
        drivers: [] as MapDriverRow[],
        sosAlerts: [] as MapSosEntity[],
        hazards: [] as MapHazardEntity[],
      });
    }

    return this.transactions.execute(async (client) => {
      const tx = client as Prisma.TransactionClient;
      const [organizations, attorneys, sosAlerts, historyRows, hazards] =
        await Promise.all([
          this.mapOrganizationsInBounds(tx, organizationIds, bounds),
          this.mapAttorneysInBounds(tx, organizationIds, bounds),
          this.mapSosAlertsInBounds(tx, sosOrganizationIds, bounds),
          this.latestDriverLocationsInBounds(
            tx,
            allowedDriverIds,
            excludeLiveDriverIds,
            bounds,
          ),
          this.mapHazardsInBounds(tx, organizationIds, bounds),
        ]);

      const driverIds = [
        ...new Set([
          ...liveDriverIds,
          ...historyRows.map((row) => row.driverId),
        ]),
      ];
      const drivers =
        driverIds.length === 0
          ? []
          : await tx.driver.findMany({
              where: { id: { in: driverIds }, status: 'ACTIVE' },
              select: {
                id: true,
                userId: true,
                licensePlate: true,
                user: {
                  select: {
                    profile: { select: { name: true, avatarUrl: true } },
                  },
                },
                organizationMembers: {
                  where: { status: 'ACTIVE', role: 'DRIVER' },
                  select: {
                    fleetMembers: {
                      where: { status: 'ACTIVE' },
                      orderBy: { joinedAt: 'desc' },
                      take: 1,
                      select: {
                        fleet: {
                          select: { id: true, name: true, color: true },
                        },
                      },
                    },
                  },
                },
              },
            });

      return {
        organizations,
        attorneys,
        historyRows,
        drivers,
        sosAlerts,
        hazards,
      };
    });
  }

  /**
   * All visible map points for the caller with no viewport filter.
   * Used by GET /map/overview to compute fit-bounds.
   */
  mapOverview(input: {
    organizationIds: string[] | null;
    sosOrganizationIds: string[] | null;
    allowedDriverIds: string[] | null;
    liveDriverIds: string[];
    excludeLiveDriverIds: string[];
  }) {
    const {
      organizationIds,
      sosOrganizationIds,
      allowedDriverIds,
      liveDriverIds,
      excludeLiveDriverIds,
    } = input;
    if (allowedDriverIds?.length === 0 && organizationIds?.length === 0) {
      return Promise.resolve({
        organizations: [] as MapAddressEntity[],
        attorneys: [] as MapAddressEntity[],
        historyRows: [] as LatestDriverLocationRow[],
        drivers: [] as MapDriverRow[],
        sosAlerts: [] as MapSosEntity[],
        hazards: [] as MapHazardEntity[],
      });
    }

    return this.transactions.execute(async (client) => {
      const tx = client as Prisma.TransactionClient;
      const [organizations, attorneys, sosAlerts, historyRows, hazards] =
        await Promise.all([
          this.mapOrganizationsAll(tx, organizationIds),
          this.mapAttorneysAll(tx, organizationIds),
          this.mapSosAlertsAll(tx, sosOrganizationIds),
          this.latestDriverLocationsAll(
            tx,
            allowedDriverIds,
            excludeLiveDriverIds,
          ),
          this.mapHazardsAll(tx, organizationIds),
        ]);

      const driverIds = [
        ...new Set([
          ...liveDriverIds,
          ...historyRows.map((row) => row.driverId),
        ]),
      ];
      const drivers =
        driverIds.length === 0
          ? []
          : await tx.driver.findMany({
              where: { id: { in: driverIds }, status: 'ACTIVE' },
              select: {
                id: true,
                userId: true,
                licensePlate: true,
                user: {
                  select: {
                    profile: { select: { name: true, avatarUrl: true } },
                  },
                },
                organizationMembers: {
                  where: { status: 'ACTIVE', role: 'DRIVER' },
                  select: {
                    fleetMembers: {
                      where: { status: 'ACTIVE' },
                      orderBy: { joinedAt: 'desc' },
                      take: 1,
                      select: {
                        fleet: {
                          select: { id: true, name: true, color: true },
                        },
                      },
                    },
                  },
                },
              },
            });

      return {
        organizations,
        attorneys,
        historyRows,
        drivers,
        sosAlerts,
        hazards,
      };
    });
  }

  private latestDriverLocationsInBounds(
    tx: Prisma.TransactionClient,
    driverIds: string[] | null,
    excludeDriverIds: string[],
    bounds: { north: number; south: number; east: number; west: number },
  ) {
    if (driverIds?.length === 0)
      return Promise.resolve<LatestDriverLocationRow[]>([]);

    if (driverIds === null) {
      return tx.$queryRaw<LatestDriverLocationRow[]>`
        SELECT latest.*
        FROM (
          SELECT DISTINCT ON (lh."driverId")
            lh."driverId",
            lh.lat,
            lh.lon,
            lh.speed,
            lh.heading,
            lh."deviceTs",
            lh."receivedTs"
          FROM location_history lh
          INNER JOIN drivers d ON d.id = lh."driverId" AND d.status = 'ACTIVE'
          WHERE NOT (lh."driverId" = ANY(${excludeDriverIds}::text[]))
          ORDER BY lh."driverId", lh."deviceTs" DESC
        ) latest
        WHERE latest.lat BETWEEN ${bounds.south} AND ${bounds.north}
          AND latest.lon BETWEEN ${bounds.west} AND ${bounds.east}
      `;
    }

    return tx.$queryRaw<LatestDriverLocationRow[]>`
      SELECT latest.*
      FROM (
        SELECT DISTINCT ON (lh."driverId")
          lh."driverId",
          lh.lat,
          lh.lon,
          lh.speed,
          lh.heading,
          lh."deviceTs",
          lh."receivedTs"
        FROM location_history lh
        INNER JOIN drivers d ON d.id = lh."driverId" AND d.status = 'ACTIVE'
        WHERE lh."driverId" = ANY(${driverIds}::text[])
          AND NOT (lh."driverId" = ANY(${excludeDriverIds}::text[]))
        ORDER BY lh."driverId", lh."deviceTs" DESC
      ) latest
      WHERE latest.lat BETWEEN ${bounds.south} AND ${bounds.north}
        AND latest.lon BETWEEN ${bounds.west} AND ${bounds.east}
    `;
  }

  private mapOrganizationsInBounds(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
    bounds: { north: number; south: number; east: number; west: number },
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    if (organizationIds === null) {
      return tx.$queryRaw<MapAddressEntity[]>`
        SELECT
          o.id,
          o.name,
          o."logoUrl" AS "logoUrl",
          NULL::text AS "avatarUrl",
          a.latitude,
          a.longitude,
          a.city,
          a.state
        FROM organizations o
        INNER JOIN addresses a ON a."organizationId" = o.id
        WHERE o.status = 'ACTIVE'
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
          AND CAST(a.latitude AS double precision) BETWEEN ${bounds.south} AND ${bounds.north}
          AND CAST(a.longitude AS double precision) BETWEEN ${bounds.west} AND ${bounds.east}
      `;
    }

    return tx.$queryRaw<MapAddressEntity[]>`
      SELECT
        o.id,
        o.name,
        o."logoUrl" AS "logoUrl",
        NULL::text AS "avatarUrl",
        a.latitude,
        a.longitude,
        a.city,
        a.state
      FROM organizations o
      INNER JOIN addresses a ON a."organizationId" = o.id
      WHERE o.status = 'ACTIVE'
        AND o.id = ANY(${organizationIds}::text[])
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
        AND CAST(a.latitude AS double precision) BETWEEN ${bounds.south} AND ${bounds.north}
        AND CAST(a.longitude AS double precision) BETWEEN ${bounds.west} AND ${bounds.east}
    `;
  }

  private mapSosAlertsInBounds(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
    bounds: { north: number; south: number; east: number; west: number },
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    return tx.incidentAlert
      .findMany({
        where: {
          type: 'SOS',
          status: { not: 'RESOLVED' },
          lat: { not: null, gte: bounds.south, lte: bounds.north },
          lon: { not: null, gte: bounds.west, lte: bounds.east },
          ...(organizationIds
            ? {
                driver: {
                  organizationMembers: {
                    some: {
                      organizationId: { in: organizationIds },
                      role: 'DRIVER',
                      status: 'ACTIVE',
                    },
                  },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          driverId: true,
          status: true,
          message: true,
          lat: true,
          lon: true,
          createdAt: true,
          driver: {
            select: {
              user: {
                select: {
                  profile: { select: { name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          driverId: row.driverId,
          status: row.status,
          message: row.message,
          lat: row.lat!,
          lon: row.lon!,
          createdAt: row.createdAt,
          name: row.driver.user.profile?.name ?? null,
          avatarUrl: row.driver.user.profile?.avatarUrl ?? null,
        })),
      );
  }

  private mapAttorneysInBounds(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
    bounds: { north: number; south: number; east: number; west: number },
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    if (organizationIds === null) {
      return tx.$queryRaw<MapAddressEntity[]>`
        SELECT
          a.id,
          a.name,
          NULL::text AS "logoUrl",
          a."avatarUrl" AS "avatarUrl",
          addr.latitude,
          addr.longitude,
          addr.city,
          addr.state
        FROM attorneys a
        INNER JOIN addresses addr ON addr."attorneyId" = a.id
        WHERE addr.latitude IS NOT NULL
          AND addr.longitude IS NOT NULL
          AND CAST(addr.latitude AS double precision) BETWEEN ${bounds.south} AND ${bounds.north}
          AND CAST(addr.longitude AS double precision) BETWEEN ${bounds.west} AND ${bounds.east}
      `;
    }

    return tx.$queryRaw<MapAddressEntity[]>`
      SELECT DISTINCT
        a.id,
        a.name,
        NULL::text AS "logoUrl",
        a."avatarUrl" AS "avatarUrl",
        addr.latitude,
        addr.longitude,
        addr.city,
        addr.state
      FROM attorneys a
      INNER JOIN addresses addr ON addr."attorneyId" = a.id
      INNER JOIN cases c ON c."attorneyId" = a.id
      INNER JOIN drivers d ON d.id = c."driverId"
      INNER JOIN organization_members om ON om."driverId" = d.id
      WHERE om."organizationId" = ANY(${organizationIds}::text[])
        AND om.status = 'ACTIVE'
        AND addr.latitude IS NOT NULL
        AND addr.longitude IS NOT NULL
        AND CAST(addr.latitude AS double precision) BETWEEN ${bounds.south} AND ${bounds.north}
        AND CAST(addr.longitude AS double precision) BETWEEN ${bounds.west} AND ${bounds.east}
    `;
  }

  private latestDriverLocationsAll(
    tx: Prisma.TransactionClient,
    driverIds: string[] | null,
    excludeDriverIds: string[],
  ) {
    if (driverIds?.length === 0)
      return Promise.resolve<LatestDriverLocationRow[]>([]);

    if (driverIds === null) {
      return tx.$queryRaw<LatestDriverLocationRow[]>`
        SELECT DISTINCT ON (lh."driverId")
          lh."driverId",
          lh.lat,
          lh.lon,
          lh.speed,
          lh.heading,
          lh."deviceTs",
          lh."receivedTs"
        FROM location_history lh
        INNER JOIN drivers d ON d.id = lh."driverId" AND d.status = 'ACTIVE'
        WHERE NOT (lh."driverId" = ANY(${excludeDriverIds}::text[]))
        ORDER BY lh."driverId", lh."deviceTs" DESC
      `;
    }

    return tx.$queryRaw<LatestDriverLocationRow[]>`
      SELECT DISTINCT ON (lh."driverId")
        lh."driverId",
        lh.lat,
        lh.lon,
        lh.speed,
        lh.heading,
        lh."deviceTs",
        lh."receivedTs"
      FROM location_history lh
      INNER JOIN drivers d ON d.id = lh."driverId" AND d.status = 'ACTIVE'
      WHERE lh."driverId" = ANY(${driverIds}::text[])
        AND NOT (lh."driverId" = ANY(${excludeDriverIds}::text[]))
      ORDER BY lh."driverId", lh."deviceTs" DESC
    `;
  }

  private mapOrganizationsAll(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    if (organizationIds === null) {
      return tx.$queryRaw<MapAddressEntity[]>`
        SELECT
          o.id,
          o.name,
          o."logoUrl" AS "logoUrl",
          NULL::text AS "avatarUrl",
          a.latitude,
          a.longitude,
          a.city,
          a.state
        FROM organizations o
        INNER JOIN addresses a ON a."organizationId" = o.id
        WHERE o.status = 'ACTIVE'
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
      `;
    }

    return tx.$queryRaw<MapAddressEntity[]>`
      SELECT
        o.id,
        o.name,
        o."logoUrl" AS "logoUrl",
        NULL::text AS "avatarUrl",
        a.latitude,
        a.longitude,
        a.city,
        a.state
      FROM organizations o
      INNER JOIN addresses a ON a."organizationId" = o.id
      WHERE o.status = 'ACTIVE'
        AND o.id = ANY(${organizationIds}::text[])
        AND a.latitude IS NOT NULL
        AND a.longitude IS NOT NULL
    `;
  }

  private mapSosAlertsAll(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    return tx.incidentAlert
      .findMany({
        where: {
          type: 'SOS',
          status: { not: 'RESOLVED' },
          lat: { not: null },
          lon: { not: null },
          ...(organizationIds
            ? {
                driver: {
                  organizationMembers: {
                    some: {
                      organizationId: { in: organizationIds },
                      role: 'DRIVER',
                      status: 'ACTIVE',
                    },
                  },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          driverId: true,
          status: true,
          message: true,
          lat: true,
          lon: true,
          createdAt: true,
          driver: {
            select: {
              user: {
                select: {
                  profile: { select: { name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          driverId: row.driverId,
          status: row.status,
          message: row.message,
          lat: row.lat!,
          lon: row.lon!,
          createdAt: row.createdAt,
          name: row.driver.user.profile?.name ?? null,
          avatarUrl: row.driver.user.profile?.avatarUrl ?? null,
        })),
      );
  }

  private mapAttorneysAll(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    if (organizationIds === null) {
      return tx.$queryRaw<MapAddressEntity[]>`
        SELECT
          a.id,
          a.name,
          NULL::text AS "logoUrl",
          a."avatarUrl" AS "avatarUrl",
          addr.latitude,
          addr.longitude,
          addr.city,
          addr.state
        FROM attorneys a
        INNER JOIN addresses addr ON addr."attorneyId" = a.id
        WHERE addr.latitude IS NOT NULL
          AND addr.longitude IS NOT NULL
      `;
    }

    return tx.$queryRaw<MapAddressEntity[]>`
      SELECT DISTINCT
        a.id,
        a.name,
        NULL::text AS "logoUrl",
        a."avatarUrl" AS "avatarUrl",
        addr.latitude,
        addr.longitude,
        addr.city,
        addr.state
      FROM attorneys a
      INNER JOIN addresses addr ON addr."attorneyId" = a.id
      INNER JOIN cases c ON c."attorneyId" = a.id
      INNER JOIN drivers d ON d.id = c."driverId"
      INNER JOIN organization_members om ON om."driverId" = d.id
      WHERE om."organizationId" = ANY(${organizationIds}::text[])
        AND om.status = 'ACTIVE'
        AND addr.latitude IS NOT NULL
        AND addr.longitude IS NOT NULL
    `;
  }

  private mapHazardsInBounds(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
    bounds: { north: number; south: number; east: number; west: number },
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    return tx.hazardReport.findMany({
      where: {
        status: 'OPEN',
        type: 'POLICE_ICE',
        expiresAt: { gt: new Date() },
        lat: { gte: bounds.south, lte: bounds.north },
        lon: { gte: bounds.west, lte: bounds.east },
        ...this.hazardOrgFilter(organizationIds),
      },
      orderBy: { lastReportedAt: 'desc' },
      select: {
        id: true,
        status: true,
        lat: true,
        lon: true,
        confirmCount: true,
        clearCount: true,
        radiusMeters: true,
        lastReportedAt: true,
        expiresAt: true,
      },
    });
  }

  private mapHazardsAll(
    tx: Prisma.TransactionClient,
    organizationIds: string[] | null,
  ) {
    if (organizationIds?.length === 0) return Promise.resolve([]);

    return tx.hazardReport.findMany({
      where: {
        status: 'OPEN',
        type: 'POLICE_ICE',
        expiresAt: { gt: new Date() },
        ...this.hazardOrgFilter(organizationIds),
      },
      orderBy: { lastReportedAt: 'desc' },
      select: {
        id: true,
        status: true,
        lat: true,
        lon: true,
        confirmCount: true,
        clearCount: true,
        radiusMeters: true,
        lastReportedAt: true,
        expiresAt: true,
      },
    });
  }

  private hazardOrgFilter(organizationIds: string[] | null) {
    if (!organizationIds) return {};
    return {
      OR: [
        { organizationId: { in: organizationIds } },
        {
          createdByDriver: {
            organizationMembers: {
              some: {
                organizationId: { in: organizationIds },
                role: 'DRIVER' as const,
                status: 'ACTIVE' as const,
              },
            },
          },
        },
      ],
    };
  }
}
