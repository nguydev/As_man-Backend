import { Inject, Injectable } from '@nestjs/common';
import { CACHE_PORT } from '@/infrastructure/redis/redis.constants';
import type { CachePort } from '@/infrastructure/redis/redis.types';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import { LocationRepository } from '@/modules/location/repositories/location.repository';
@Injectable()
export class LocationMembershipService {
  constructor(
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    private readonly redis: RedisAdapter,
    private readonly locations: LocationRepository,
  ) {}
  async activeOrganizationIds(driverId: string): Promise<string[]> {
    const key = `driver:${driverId}:orgs`;
    const versionKey = `${key}:version`;
    const client = await this.redis.getClient();
    const version = Number((await client.get(versionKey)) ?? 0);
    const cached = await this.cache.get<{ version: number; ids: string[] }>(
      key,
    );
    if (cached?.version === version) {
      await this.cache.set(key, cached, 300);
      return cached.ids;
    }
    const rows = await this.locations.activeOrganizationIds(driverId);
    const ids = rows.map((row) => row.organizationId);
    const currentVersion = Number((await client.get(versionKey)) ?? 0);
    if (currentVersion !== version) {
      return this.activeOrganizationIds(driverId);
    }
    await this.cache.set(key, { version, ids }, 300);
    return ids;
  }
}
