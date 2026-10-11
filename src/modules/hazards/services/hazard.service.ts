import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import locals from '@/locals';
import type {
  ListHazardsQueryDto,
  ReportHazardDto,
} from '@/modules/hazards/dto/hazard.dto';
import {
  HazardRepository,
  type HazardRow,
} from '@/modules/hazards/repositories/hazard.repository';
import {
  COOLDOWN_SECONDS,
  MERGE_RADIUS_METERS,
  metersBetween,
  shouldClear,
  toPublicHazard,
  ttlFrom,
} from '@/modules/hazards/types/hazard.types';
import { LocationFanoutService } from '@/modules/location/services/location-fanout.service';
import { LocationMembershipService } from '@/modules/location/services/location-membership.service';
import { MapVisibilityService } from '@/modules/location/services/map-visibility.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';

@Injectable()
export class HazardService {
  constructor(
    private readonly hazards: HazardRepository,
    private readonly memberships: LocationMembershipService,
    private readonly visibility: MapVisibilityService,
    private readonly fanout: LocationFanoutService,
    private readonly redis: RedisAdapter,
    private readonly notifications: NotificationService,
  ) {}

  async list(user: AuthenticatedUser, query: ListHazardsQueryDto) {
    if (query.north <= query.south || query.east <= query.west) {
      throw new BadRequestException(locals.location.invalid_map_bounds);
    }
    const { organizationIds } = await this.visibility.resolve(user);
    const rows = await this.hazards.listOpenInBounds({
      organizationIds,
      bounds: query,
    });
    return rows.map((row) => toPublicHazard(row));
  }

  async report(user: AuthenticatedUser, dto: ReportHazardDto) {
    const driver = await this.requireDriver(user.sub);
    if (!Number.isFinite(dto.lat) || !Number.isFinite(dto.lon)) {
      throw new BadRequestException(locals.hazards.gps_required);
    }

    const organizationIds = await this.memberships.activeOrganizationIds(
      driver.id,
    );
    if (organizationIds.length === 0) {
      throw new BadRequestException(locals.hazards.no_organization);
    }

    const nearby = await this.findNearby(
      organizationIds,
      dto.lat,
      dto.lon,
    );
    if (nearby) {
      const updated = await this.confirmExisting(
        nearby,
        driver.id,
        organizationIds,
      );
      return toPublicHazard(updated, { merged: true });
    }

    await this.assertCooldown(driver.id);
    const created = await this.hazards.create({
      lat: dto.lat,
      lon: dto.lon,
      organizationId: organizationIds[0]!,
      createdByDriverId: driver.id,
      createdByUserId: user.sub,
      expiresAt: ttlFrom(),
    });
    await this.fanoutHazard(created, organizationIds);
    await this.notifyDrivers(created, organizationIds, user.sub);
    return toPublicHazard(created, { merged: false });
  }

  async confirm(user: AuthenticatedUser, id: string) {
    const driver = await this.requireDriver(user.sub);
    const hazard = await this.requireOpen(id);
    const organizationIds = await this.viewerOrgs(driver.id, hazard);
    const updated = await this.confirmExisting(
      hazard,
      driver.id,
      organizationIds,
    );
    return toPublicHazard(updated);
  }

  async clear(user: AuthenticatedUser, id: string) {
    const driver = await this.requireDriver(user.sub);
    const hazard = await this.requireOpen(id);
    const organizationIds = await this.viewerOrgs(driver.id, hazard);
    const existing = await this.hazards.findVote(hazard.id, driver.id);

    if (existing?.vote === 'CLEAR') {
      return toPublicHazard(hazard);
    }

    let confirmDelta = 0;
    let clearDelta = 1;
    if (existing?.vote === 'CONFIRM') {
      confirmDelta = -1;
    }

    const nextConfirm = hazard.confirmCount + confirmDelta;
    const nextClear = hazard.clearCount + clearDelta;
    const closed = shouldClear(nextConfirm, nextClear);

    const updated = await this.hazards.applyVote({
      hazardId: hazard.id,
      driverId: driver.id,
      vote: 'CLEAR',
      confirmDelta,
      clearDelta,
      status: closed ? 'CLEARED' : 'OPEN',
      clearedAt: closed ? new Date() : null,
      clearedByDriverId: closed ? driver.id : null,
    });

    if (closed) {
      this.fanout.hazardCleared(organizationIds, { id: hazard.id });
    } else {
      await this.fanoutHazard(updated, organizationIds);
    }
    return toPublicHazard(updated);
  }

  async expireOpen() {
    const rows = await this.hazards.expireOpen();
    if (rows.length === 0) return { expired: 0 };
    await this.hazards.markExpired(rows.map((row) => row.id));
    for (const row of rows) {
      const orgIds = await this.memberships.activeOrganizationIds(
        row.createdByDriverId,
      );
      const ids = [...new Set([row.organizationId, ...orgIds])];
      this.fanout.hazardCleared(ids, { id: row.id });
    }
    return { expired: rows.length };
  }

  private async confirmExisting(
    hazard: HazardRow,
    driverId: string,
    organizationIds: string[],
  ) {
    const existing = await this.hazards.findVote(hazard.id, driverId);
    if (existing?.vote === 'CONFIRM') {
      const refreshed = await this.hazards.refreshConfirm(
        hazard.id,
        ttlFrom(),
      );
      await this.fanoutHazard(refreshed, organizationIds);
      return refreshed;
    }

    let confirmDelta = 1;
    let clearDelta = 0;
    if (existing?.vote === 'CLEAR') {
      clearDelta = -1;
    }

    const updated = await this.hazards.applyVote({
      hazardId: hazard.id,
      driverId,
      vote: 'CONFIRM',
      confirmDelta,
      clearDelta,
      expiresAt: ttlFrom(),
      status: 'OPEN',
      clearedAt: null,
      clearedByDriverId: null,
    });
    await this.fanoutHazard(updated, organizationIds);
    return updated;
  }

  private async findNearby(
    organizationIds: string[],
    lat: number,
    lon: number,
  ) {
    const deltaLat = (MERGE_RADIUS_METERS + 50) / 111_320;
    const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.1);
    const deltaLon = deltaLat / cos;
    const candidates = await this.hazards.findOpenInRadiusBox({
      organizationIds,
      lat,
      lon,
      deltaLat,
      deltaLon,
    });
    let closest: HazardRow | null = null;
    let closestMeters = MERGE_RADIUS_METERS;
    for (const row of candidates) {
      const meters = metersBetween(lat, lon, Number(row.lat), Number(row.lon));
      if (meters <= closestMeters) {
        closest = row;
        closestMeters = meters;
      }
    }
    return closest;
  }

  private async fanoutHazard(row: HazardRow, organizationIds: string[]) {
    const ids = [...new Set([row.organizationId, ...organizationIds])];
    this.fanout.hazard(ids, toPublicHazard(row));
  }

  private async notifyDrivers(
    row: HazardRow,
    organizationIds: string[],
    reporterUserId: string,
  ) {
    const ids = [...new Set([row.organizationId, ...organizationIds])];
    await this.notifications.notifyOrganizationDrivers(
      ids,
      {
        title: locals.notifications.hazard_title,
        body: locals.notifications.hazard_body,
        data: {
          type: 'HAZARD',
          hazardId: row.id,
          lat: Number(row.lat),
          lng: Number(row.lon),
        },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
        expiresAt: row.expiresAt,
      },
      reporterUserId,
    );
  }

  private async viewerOrgs(driverId: string, hazard: HazardRow) {
    const organizationIds = await this.memberships.activeOrganizationIds(
      driverId,
    );
    if (
      organizationIds.length === 0 ||
      (!organizationIds.includes(hazard.organizationId) &&
        hazard.createdByDriverId !== driverId)
    ) {
      const creatorOrgs = await this.memberships.activeOrganizationIds(
        hazard.createdByDriverId,
      );
      const overlap = organizationIds.some((id) => creatorOrgs.includes(id));
      if (!overlap && !organizationIds.includes(hazard.organizationId)) {
        throw new ForbiddenException(locals.hazards.access_denied);
      }
    }
    return [...new Set([hazard.organizationId, ...organizationIds])];
  }

  private async requireDriver(userId: string) {
    const driver = await this.hazards.driver(userId);
    if (!driver) throw new NotFoundException(locals.hazards.driver_required);
    return driver;
  }

  private async requireOpen(id: string) {
    const hazard = await this.hazards.findOpen(id);
    if (!hazard) throw new NotFoundException(locals.hazards.not_found);
    if (hazard.status !== 'OPEN' || hazard.expiresAt <= new Date()) {
      throw new ConflictException(locals.hazards.not_open);
    }
    return hazard;
  }

  private async assertCooldown(driverId: string) {
    const client = await this.redis.getClient();
    const locked = await client.set(
      `driver:${driverId}:hazard-cooldown`,
      '1',
      'EX',
      COOLDOWN_SECONDS,
      'NX',
    );
    if (!locked) {
      throw new ConflictException(locals.hazards.cooldown);
    }
  }
}
