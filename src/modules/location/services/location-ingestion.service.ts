import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import {
  LOCATION_HISTORY_JOB_FLUSH,
  LOCATION_HISTORY_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import type { LocationPing } from '@/modules/location/types/location.types';
import { LocationMembershipService } from '@/modules/location/services/location-membership.service';
import { LocationFanoutService } from '@/modules/location/services/location-fanout.service';
import { DetentionService } from '@/modules/location/services/detention.service';
@Injectable()
export class LocationIngestionService {
  constructor(
    private readonly redis: RedisAdapter,
    private readonly memberships: LocationMembershipService,
    private readonly fanout: LocationFanoutService,
    private readonly detention: DetentionService,
    @InjectQueue(LOCATION_HISTORY_QUEUE) private readonly queue: Queue,
  ) {}
  async ingest(driverId: string, ping: LocationPing) {
    const client = await this.redis.getClient();
    const point = { ...ping, driverId, receivedTs: new Date().toISOString() };
    await client.geoadd('fleet:live', ping.lon, ping.lat, driverId);
    const metaKey = `driver:${driverId}:meta`;
    const deviceTsMs = Date.parse(ping.deviceTs);
    await client.eval(
      `local current = tonumber(redis.call('HGET', KEYS[1], 'deviceTsMs'))
       if not current or tonumber(ARGV[1]) >= current then
         redis.call('HSET', KEYS[1], 'lat', ARGV[2], 'lon', ARGV[3], 'speed', ARGV[4], 'heading', ARGV[5], 'deviceTs', ARGV[6], 'deviceTsMs', ARGV[1], 'receivedTs', ARGV[7])
         return 1
       end
       return 0`,
      1,
      metaKey,
      deviceTsMs,
      ping.lat,
      ping.lon,
      String(ping.speed ?? ''),
      String(ping.heading ?? ''),
      ping.deviceTs,
      point.receivedTs,
    );
    await client.rpush(`location:buffer:${driverId}`, JSON.stringify(point));
    await this.queue.add(
      LOCATION_HISTORY_JOB_FLUSH,
      { driverId },
      {
        jobId: `${driverId}-${Math.floor(Date.now() / 5000)}`,
        delay: 5000,
      },
    );
    const allowed = await client.set(
      `throttle:driver:${driverId}`,
      '1',
      'EX',
      3,
      'NX',
    );
    if (allowed)
      this.fanout.locations(
        await this.memberships.activeOrganizationIds(driverId),
        point,
      );
    await this.detention.observe(driverId, ping.lat, ping.lon);
    return point;
  }
}
