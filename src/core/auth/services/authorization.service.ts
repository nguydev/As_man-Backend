import { Injectable } from '@nestjs/common';
import { normalizePermissionMap } from '@/core/auth/helpers/permission.helper';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { AuthCacheService } from '@/core/auth/services/auth-cache.service';
import type { AuthorizationSnapshot } from '@/core/auth/types/authorization.type';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly cache: AuthCacheService,
    private readonly users: UserRepository,
  ) {}

  async get(userId: string): Promise<AuthorizationSnapshot | null> {
    const cached = await this.cache.getAuthorization(userId);
    if (cached) return cached;

    const user = await this.users.findAuthorizationById(userId);
    if (!user) return null;

    const snapshot: AuthorizationSnapshot = {
      role: user.role,
      status: user.status,
      isDeleted: user.isDeleted,
      permissions: normalizePermissionMap(user.maintainer?.permissions),
    };
    await this.cache.setAuthorization(userId, snapshot);
    return snapshot;
  }

  invalidate(userId: string): Promise<void> {
    return this.cache.deleteAuthorization(userId);
  }
}
