import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import {
  MapLocationRepository,
  type LatestDriverLocationRow,
  type MapAddressEntity,
  type MapHazardEntity,
  type MapSosEntity,
} from '@/modules/location/repositories/map-location.repository';
import type { MapLocationsQueryDto } from '@/modules/location/dto/map-locations.dto';
import type { MapOverviewResponseDto } from '@/modules/location/dto/map-overview.dto';
import { MapVisibilityService } from '@/modules/location/services/map-visibility.service';
import { MembershipRepository } from '@/modules/memberships/repositories/membership.repository';
import locals from '@/locals';

type MapPoint = {
  id: string;
  role: 'DRIVER' | 'ATTORNEY' | 'ORGANIZATION' | 'SOS' | 'HAZARD';
  lat: number;
  lng: number;
  live: boolean;
  name: string | null;
  avatar: string | null;
  userId?: string | null;
  driverId?: string;
  unitNumber?: string | null;
  speed?: number;
  heading?: number;
  deviceTs?: string;
  receivedTs?: string;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  detail?: string | null;
  createdAt?: string;
  fleetId?: string | null;
  fleetName?: string | null;
  fleetColor?: string | null;
  confirmCount?: number;
  clearCount?: number;
  radiusMeters?: number;
  expiresAt?: string;
};

type LiveMapPoint = {
  driverId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  deviceTs: string;
  receivedTs: string;
};

@Injectable()
export class MapLocationService {
  constructor(
    private readonly redis: RedisAdapter,
    private readonly locations: MapLocationRepository,
    private readonly visibility: MapVisibilityService,
    private readonly memberships: MembershipRepository,
  ) {}

  async list(user: AuthenticatedUser, query: MapLocationsQueryDto) {
    this.assertBounds(query);

    const { organizationIds, sosOrganizationIds, allowedDriverIds } =
      await this.visibility.resolve(user);
    if (allowedDriverIds?.length === 0 && organizationIds?.length === 0) {
      return { clusters: [], markers: [] };
    }

    const [livePoints, excludeLiveDriverIds] = await Promise.all([
      allowedDriverIds?.length === 0
        ? Promise.resolve([] as LiveMapPoint[])
        : this.livePointsInBounds(query, allowedDriverIds),
      this.liveDriverIds(allowedDriverIds),
    ]);

    const { organizations, attorneys, historyRows, drivers, sosAlerts, hazards } =
      await this.locations.mapViewport({
        organizationIds,
        sosOrganizationIds,
        allowedDriverIds,
        liveDriverIds: livePoints.map((point) => point.driverId),
        excludeLiveDriverIds,
        bounds: query,
      });

    const byDriverId = new Map(drivers.map((driver) => [driver.id, driver]));
    const driverMarkers = [
      ...this.driverMarkers(livePoints, byDriverId, true),
      ...this.driverMarkers(
        historyRows.map((row) => this.fromHistoryRow(row)),
        byDriverId,
        false,
      ),
    ];

    const points = [
      ...driverMarkers,
      ...organizations
        .map((org) => this.addressMarker(org, 'ORGANIZATION'))
        .filter((marker): marker is MapPoint => Boolean(marker)),
      ...attorneys
        .map((attorney) => this.addressMarker(attorney, 'ATTORNEY'))
        .filter((marker): marker is MapPoint => Boolean(marker)),
      ...sosAlerts
        .map((alert) => this.sosMarker(alert))
        .filter((marker): marker is MapPoint => Boolean(marker)),
      ...hazards
        .map((hazard) => this.hazardMarker(hazard))
        .filter((marker): marker is MapPoint => Boolean(marker)),
    ];

    if (query.zoom < 10 && points.length > 25) {
      return { clusters: this.clusters(points, query.zoom), markers: [] };
    }

    return { clusters: [], markers: points };
  }

  private async organizationFocus(
    user: AuthenticatedUser,
    organizationId: string,
  ): Promise<MapOverviewResponseDto> {
    const { organizationIds } = await this.visibility.resolve(user);
    if (organizationIds !== null && !organizationIds.includes(organizationId)) {
      throw new ForbiddenException(
        locals.memberships.organization_access_denied,
      );
    }

    const driverRows = await this.memberships.activeDriverIdsInOrganizations([
      organizationId,
    ]);
    const allowedDriverIds = driverRows
      .map((row) => row.driverId)
      .filter((id): id is string => Boolean(id));

    return this.overviewForScope({
      organizationIds: [organizationId],
      sosOrganizationIds: [organizationId],
      allowedDriverIds,
    });
  }

  /**
   * Fit-bounds for all points visible to the caller (no viewport filter).
   * Flutter uses this on map open before calling /map/locations.
   */
  async overview(
    user: AuthenticatedUser,
    organizationId?: string,
  ): Promise<MapOverviewResponseDto> {
    if (organizationId) return this.organizationFocus(user, organizationId);

    const scope = await this.visibility.resolve(user);
    return this.overviewForScope(scope);
  }

  private async overviewForScope(input: {
    organizationIds: string[] | null;
    sosOrganizationIds: string[] | null;
    allowedDriverIds: string[] | null;
  }): Promise<MapOverviewResponseDto> {
    const emptyCounts = {
      drivers: 0,
      organizations: 0,
      attorneys: 0,
      sos: 0,
      hazards: 0,
      total: 0,
    };

    const { organizationIds, sosOrganizationIds, allowedDriverIds } = input;
    if (allowedDriverIds?.length === 0 && organizationIds?.length === 0) {
      return {
        empty: true,
        center: null,
        bounds: null,
        zoom: null,
        counts: emptyCounts,
      };
    }

    const [livePoints, excludeLiveDriverIds] = await Promise.all([
      allowedDriverIds?.length === 0
        ? Promise.resolve([] as LiveMapPoint[])
        : this.livePointsAll(allowedDriverIds),
      this.liveDriverIds(allowedDriverIds),
    ]);

    const { organizations, attorneys, historyRows, drivers, sosAlerts, hazards } =
      await this.locations.mapOverview({
        organizationIds,
        sosOrganizationIds,
        allowedDriverIds,
        liveDriverIds: livePoints.map((point) => point.driverId),
        excludeLiveDriverIds,
      });

    const byDriverId = new Map(drivers.map((driver) => [driver.id, driver]));
    const driverMarkers = [
      ...this.driverMarkers(livePoints, byDriverId, true),
      ...this.driverMarkers(
        historyRows.map((row) => this.fromHistoryRow(row)),
        byDriverId,
        false,
      ),
    ];

    const orgMarkers = organizations
      .map((org) => this.addressMarker(org, 'ORGANIZATION'))
      .filter((marker): marker is MapPoint => Boolean(marker));
    const attorneyMarkers = attorneys
      .map((attorney) => this.addressMarker(attorney, 'ATTORNEY'))
      .filter((marker): marker is MapPoint => Boolean(marker));
    const sosMarkers = sosAlerts
      .map((alert) => this.sosMarker(alert))
      .filter((marker): marker is MapPoint => Boolean(marker));
    const hazardMarkers = hazards
      .map((hazard) => this.hazardMarker(hazard))
      .filter((marker): marker is MapPoint => Boolean(marker));

    const points = [
      ...driverMarkers,
      ...orgMarkers,
      ...attorneyMarkers,
      ...sosMarkers,
      ...hazardMarkers,
    ];

    const counts = {
      drivers: driverMarkers.length,
      organizations: orgMarkers.length,
      attorneys: attorneyMarkers.length,
      sos: sosMarkers.length,
      hazards: hazardMarkers.length,
      total: points.length,
    };

    if (points.length === 0) {
      return {
        empty: true,
        center: null,
        bounds: null,
        zoom: null,
        counts,
      };
    }

    const focusPoints =
      driverMarkers.length > 0
        ? driverMarkers
        : orgMarkers.length > 0
          ? orgMarkers
          : sosMarkers.length > 0
            ? sosMarkers
            : hazardMarkers.length > 0
              ? hazardMarkers
              : points;

    return {
      empty: false,
      ...this.fitBounds(focusPoints),
      counts,
    };
  }

  private fitBounds(points: Array<{ lat: number; lng: number }>) {
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    for (const point of points) {
      north = Math.max(north, point.lat);
      south = Math.min(south, point.lat);
      east = Math.max(east, point.lng);
      west = Math.min(west, point.lng);
    }

    const latSpan = Math.max(north - south, 0);
    const lngSpan = Math.max(east - west, 0);
    const padLat = Math.max(latSpan * 0.1, 0.005);
    const padLng = Math.max(lngSpan * 0.1, 0.005);

    north = Math.min(90, north + padLat);
    south = Math.max(-90, south - padLat);
    east = Math.min(180, east + padLng);
    west = Math.max(-180, west - padLng);

    const center = {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    };

    const midLatRad = center.lat * (Math.PI / 180);
    const adjustedLngSpan = (east - west) * Math.max(Math.cos(midLatRad), 0.1);
    const span = Math.max(north - south, adjustedLngSpan);

    let zoom: number;
    if (points.length === 1 || span < 0.01) {
      zoom = 14;
    } else if (span < 0.03) {
      zoom = 13;
    } else if (span < 0.08) {
      zoom = 12;
    } else if (span < 0.2) {
      zoom = 11;
    } else if (span < 0.5) {
      zoom = 10;
    } else if (span < 1) {
      zoom = 9;
    } else if (span < 2) {
      zoom = 8;
    } else if (span < 5) {
      zoom = 7;
    } else if (span < 10) {
      zoom = 6;
    } else if (span < 20) {
      zoom = 5;
    } else if (span < 40) {
      zoom = 4;
    } else {
      zoom = 3;
    }

    return {
      center,
      bounds: { north, south, east, west },
      zoom,
    };
  }

  private driverMarkers(
    points: LiveMapPoint[],
    byDriverId: Map<
      string,
      {
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
      }
    >,
    live: boolean,
  ) {
    const markers: MapPoint[] = [];
    for (const point of points) {
      const driver = byDriverId.get(point.driverId);
      if (!driver) continue;
      const fleet =
        driver.organizationMembers
          .flatMap((member) => member.fleetMembers)
          .map((member) => member.fleet)[0] ?? null;
      markers.push({
        id: point.driverId,
        driverId: point.driverId,
        role: 'DRIVER',
        live,
        lat: point.lat,
        lng: point.lng,
        userId: driver.userId ?? null,
        name: driver.user.profile?.name ?? null,
        avatar: driver.user.profile?.avatarUrl ?? null,
        unitNumber: driver.licensePlate ?? null,
        speed: point.speed,
        heading: point.heading,
        deviceTs: point.deviceTs,
        receivedTs: point.receivedTs,
        fleetId: fleet?.id ?? null,
        fleetName: fleet?.name ?? null,
        fleetColor: fleet?.color ?? null,
      });
    }
    return markers;
  }

  private fromHistoryRow(row: LatestDriverLocationRow): LiveMapPoint {
    const point: LiveMapPoint = {
      driverId: row.driverId,
      lat: Number(row.lat),
      lng: Number(row.lon),
      deviceTs: row.deviceTs.toISOString(),
      receivedTs: row.receivedTs.toISOString(),
    };
    if (row.speed != null) point.speed = Number(row.speed);
    if (row.heading != null) point.heading = Number(row.heading);
    return point;
  }

  private addressMarker(
    entity: MapAddressEntity,
    role: 'ATTORNEY' | 'ORGANIZATION',
  ): MapPoint | null {
    const lat = Number(entity.latitude);
    const lng = Number(entity.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      id: entity.id,
      role,
      live: false,
      lat,
      lng,
      name: entity.name ?? null,
      avatar: entity.avatarUrl ?? entity.logoUrl ?? null,
      city: entity.city ?? null,
      state: entity.state ?? null,
    };
  }

  private sosMarker(alert: MapSosEntity): MapPoint | null {
    const lat = Number(alert.lat);
    const lng = Number(alert.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      id: alert.id,
      role: 'SOS',
      live: true,
      lat,
      lng,
      driverId: alert.driverId,
      name: alert.name,
      avatar: alert.avatarUrl,
      status: alert.status,
      detail: alert.message,
      createdAt: alert.createdAt.toISOString(),
    };
  }

  private hazardMarker(hazard: MapHazardEntity): MapPoint | null {
    const lat = Number(hazard.lat);
    const lng = Number(hazard.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      id: hazard.id,
      role: 'HAZARD',
      live: true,
      lat,
      lng,
      name: 'Police/ICE report',
      avatar: null,
      status: hazard.status,
      detail:
        'Community report — not a verified law-enforcement location',
      confirmCount: hazard.confirmCount,
      clearCount: hazard.clearCount,
      radiusMeters: hazard.radiusMeters,
      createdAt: hazard.lastReportedAt.toISOString(),
      expiresAt: hazard.expiresAt.toISOString(),
    };
  }

  private async livePointsAll(allowedDriverIds: string[] | null) {
    const ids = await this.liveDriverIds(allowedDriverIds);
    if (ids.length === 0) return [];

    const client = await this.redis.getClient();
    const rows = await Promise.all(
      ids.map(async (driverId) => {
        const meta = await client.hmget(
          `driver:${driverId}:meta`,
          'lat',
          'lon',
          'speed',
          'heading',
          'deviceTs',
          'receivedTs',
        );
        return this.point(driverId, meta);
      }),
    );

    return rows.filter((point): point is LiveMapPoint => Boolean(point));
  }

  private async liveDriverIds(allowedDriverIds: string[] | null) {
    if (allowedDriverIds?.length === 0) return [];
    const client = await this.redis.getClient();
    const ids = await client.zrange('fleet:live', 0, -1);
    if (!allowedDriverIds) return ids;
    const allowed = new Set(allowedDriverIds);
    return ids.filter((id) => allowed.has(id));
  }

  private async livePointsInBounds(
    query: MapLocationsQueryDto,
    allowedDriverIds: string[] | null,
  ) {
    const client = await this.redis.getClient();
    const ids = (await client.geosearch(
      'fleet:live',
      'FROMLONLAT',
      (query.west + query.east) / 2,
      (query.south + query.north) / 2,
      'BYBOX',
      this.lngKm(query),
      this.latKm(query),
      'km',
    )) as string[];
    const allowed = allowedDriverIds ? new Set(allowedDriverIds) : null;
    const scopedIds = allowed ? ids.filter((id) => allowed.has(id)) : ids;
    if (scopedIds.length === 0) return [];

    const rows = await Promise.all(
      scopedIds.map(async (driverId) => {
        const meta = await client.hmget(
          `driver:${driverId}:meta`,
          'lat',
          'lon',
          'speed',
          'heading',
          'deviceTs',
          'receivedTs',
        );
        return this.point(driverId, meta);
      }),
    );

    return rows.filter((point): point is LiveMapPoint => Boolean(point));
  }

  private point(driverId: string, meta: Array<string | null>) {
    const [lat, lng, speed, heading, deviceTs, receivedTs] = meta;
    if (!lat || !lng || !deviceTs || !receivedTs) return null;
    const point: LiveMapPoint = {
      driverId,
      lat: Number(lat),
      lng: Number(lng),
      deviceTs,
      receivedTs,
    };
    if (speed) point.speed = Number(speed);
    if (heading) point.heading = Number(heading);
    return point;
  }

  private clusters(points: Array<{ lat: number; lng: number }>, zoom: number) {
    const size = zoom < 6 ? 2 : zoom < 8 ? 1 : 0.5;
    const buckets = new Map<
      string,
      { lat: number; lng: number; count: number }
    >();
    for (const point of points) {
      const key = `${Math.floor(point.lat / size)}:${Math.floor(point.lng / size)}`;
      const bucket = buckets.get(key) ?? { lat: 0, lng: 0, count: 0 };
      bucket.lat += point.lat;
      bucket.lng += point.lng;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.values()].map((bucket) => ({
      lat: bucket.lat / bucket.count,
      lng: bucket.lng / bucket.count,
      count: bucket.count,
      drivers: bucket.count,
    }));
  }

  private assertBounds(query: MapLocationsQueryDto) {
    if (query.north <= query.south || query.east <= query.west) {
      throw new BadRequestException(locals.location.invalid_map_bounds);
    }
  }

  private latKm(query: MapLocationsQueryDto) {
    return (query.north - query.south) * 111;
  }

  private lngKm(query: MapLocationsQueryDto) {
    const midLat = ((query.north + query.south) / 2) * (Math.PI / 180);
    return (query.east - query.west) * 111 * Math.max(Math.cos(midLat), 0.1);
  }
}
