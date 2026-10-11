import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_PORT } from '@/infrastructure/redis/redis.constants';
import type { CachePort } from '@/infrastructure/redis/redis.types';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import { LocationRepository } from '@/modules/location/repositories/location.repository';
import { LocationMembershipService } from '@/modules/location/services/location-membership.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';
import locals from '@/locals';

interface Dwell {
  lat: number;
  lon: number;
  since: number;
  alerted: boolean;
}

@Injectable()
export class DetentionService {
  private readonly logger = new Logger(DetentionService.name);

  constructor(
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    private readonly redis: RedisAdapter,
    private readonly locations: LocationRepository,
    private readonly memberships: LocationMembershipService,
    private readonly notifications: NotificationService,
  ) {}

  async observe(
    driverId: string,
    lat: number,
    lon: number,
    now = Date.now(),
  ): Promise<void> {
    const key = `driver:${driverId}:dwell`;
    const dwell = await this.cache.get<Dwell>(key);
    if (!dwell || this.distance(dwell.lat, dwell.lon, lat, lon) > 100) {
      await this.cache.set(
        key,
        { lat, lon, since: now, alerted: false },
        86400,
      );
      return;
    }
    if (!dwell.alerted && now - dwell.since >= 15 * 60_000) {
      const client = await this.redis.getClient();
      const locked = await client.set(
        `driver:${driverId}:detention-lock`,
        '1',
        'EX',
        60,
        'NX',
      );
      if (!locked) return;
      const alert = await this.locations.createDetention(driverId, lat, lon);
      await this.cache.set(key, { ...dwell, alerted: true }, 86400);

      const organizationIds =
        await this.memberships.activeOrganizationIds(driverId);
      const notify = {
        title: locals.notifications.detention_title,
        body: locals.notifications.detention_body,
        data: {
          type: 'DETENTION',
          incidentId: alert.id,
          driverId,
        },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      };
      await this.notifications.notifySystem(notify);
      await Promise.all(
        organizationIds.map((organizationId) =>
          this.notifications.notifyOrganization(organizationId, {
            ...notify,
            data: { ...notify.data, organizationId },
          }),
        ),
      );
      this.logger.log({
        event: 'detention.alerted',
        driverId,
        alertId: alert.id,
      });
    }
  }

  private distance(aLat: number, aLon: number, bLat: number, bLon: number) {
    const r = 6371000;
    const p = Math.PI / 180;
    const x = (bLon - aLon) * p * Math.cos(((aLat + bLat) / 2) * p);
    const y = (bLat - aLat) * p;
    return Math.sqrt(x * x + y * y) * r;
  }
}
