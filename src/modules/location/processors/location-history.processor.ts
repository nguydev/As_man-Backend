import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import { LOCATION_HISTORY_QUEUE } from '@/infrastructure/queue/queue.constants';
import { LocationRepository } from '@/modules/location/repositories/location.repository';
import type { LiveLocation } from '@/modules/location/types/location.types';
@Injectable()
@Processor(LOCATION_HISTORY_QUEUE)
export class LocationHistoryProcessor extends WorkerHost {
  constructor(
    private readonly redis: RedisAdapter,
    private readonly locations: LocationRepository,
  ) {
    super();
  }
  async process(job: Job<{ driverId: string }>) {
    const client = await this.redis.getClient();
    const key = `location:buffer:${job.data.driverId}`;
    const processingKey = `location:processing:${job.id}`;
    await client.eval(
      "if redis.call('EXISTS', KEYS[2]) == 0 and redis.call('EXISTS', KEYS[1]) == 1 then redis.call('RENAME', KEYS[1], KEYS[2]) end",
      2,
      key,
      processingKey,
    );
    const raw = await client.lrange(processingKey, 0, -1);
    if (!raw.length) return;
    const points = raw
      .map((value) => JSON.parse(value) as LiveLocation)
      .sort((a, b) => a.deviceTs.localeCompare(b.deviceTs));
    await this.locations.createHistory(points);
    await client.del(processingKey);
  }
}
