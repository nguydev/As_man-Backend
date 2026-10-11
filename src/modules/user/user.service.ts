import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma-client';
import type { Pagination } from '@/common/pagination/pagination.types';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { AuthorizationService } from '@/core/auth/services/authorization.service';
import { PasswordInviteService } from '@/core/auth/services/password-invite.service';
import { TokenService } from '@/core/auth/services/token.service';
import { LocationFanoutService } from '@/modules/location/services/location-fanout.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';
import type {
  CreateAdminUserDto,
  ListUsersDto,
  SearchUsersDto,
  UpdateOwnProfileDto,
  UpdateUserStatusDto,
} from '@/modules/user/dto/update-user.dto';
import locals from '@/locals';
import { format } from '@/common/utils/format.util';

@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly authorization: AuthorizationService,
    private readonly invites: PasswordInviteService,
    private readonly locationFanout: LocationFanoutService,
    private readonly notifications: NotificationService,
  ) {}

  async createForAdmin(dto: CreateAdminUserDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException(locals.auth.email_already_registered);
    }
    if (dto.phone && (await this.users.findByPhone(dto.phone))) {
      throw new ConflictException(locals.auth.phone_already_in_use);
    }

    try {
      const user = await this.users.createForAdmin(dto);
      await this.invites.issue(user.id, dto.email);
      return this.withSocketActivity(user);
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  async listForAdmin(pagination: Pagination, filters: ListUsersDto) {
    const users = await this.users.listForAdmin(pagination, filters);
    return {
      ...users,
      data: this.withSocketActivity(users.data),
    };
  }

  async stats() {
    const stats = await this.users.stats();
    return {
      total: stats.total,
      active: this.locationFanout.dashboardSubscriberCount(),
      pending: stats.pending,
      suspended: stats.suspended,
    };
  }

  async searchForAdmin(query: SearchUsersDto) {
    const users = await this.users.searchForAdmin(
      query.q ?? '',
      query.limit,
      { driversOnly: query.driversOnly },
    );
    return users.map((user) => ({
      avatar: user.profile?.avatarUrl ?? null,
      id: user.id,
      name: user.profile?.name ?? null,
      email: user.email,
      driver: user.driver
        ? {
            id: user.driver.id,
            licensePlate: user.driver.licensePlate,
            vinNumber: user.driver.vinNumber,
          }
        : null,
    }));
  }

  async getForAdmin(id: string) {
    const user = await this.users.findAdminDetails(id);
    if (!user) throw new NotFoundException(locals.users.not_found);
    return this.withSocketActivity(user);
  }

  async getOwnProfile(userId: string) {
    const user = await this.users.findOwnProfile(userId);
    if (!user) throw new NotFoundException(locals.users.not_found);
    return user;
  }

  async updateOwnProfile(userId: string, dto: UpdateOwnProfileDto) {
    if (
      dto.name === undefined &&
      dto.avatarUrl === undefined &&
      dto.phone === undefined &&
      dto.address === undefined
    ) {
      throw new BadRequestException(locals.users.profile_field_required);
    }
    await this.getOwnProfile(userId);
    try {
      return await this.users.updateProfile(userId, dto);
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  async updateStatus(
    actorId: string,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    await this.getForAdmin(userId);
    if (actorId === userId && dto.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(locals.users.cannot_restrict_self);
    }

    await this.notifications.notifyUser(userId, {
      title: locals.notifications.user_status_title,
      body: format(locals.notifications.user_status_body, {
        status: dto.status,
      }),
      data: {
        type: 'USER_STATUS',
        status: dto.status,
        reason: dto.reason ?? null,
      },
      channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
    });

    const user = await this.users.updateStatus(
      userId,
      dto.status,
      dto.status === UserStatus.ACTIVE ? null : dto.reason!,
    );
    if (dto.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeAllForUser(userId);
    } else {
      await this.authorization.invalidate(userId);
    }
    return user;
  }

  async remove(actorId: string, userId: string) {
    await this.getForAdmin(userId);
    if (actorId === userId) {
      throw new ForbiddenException(locals.users.cannot_delete_self);
    }
    await this.users.softDelete(userId);
    await this.tokens.revokeAllForUser(userId);
  }

  async restore(userId: string) {
    await this.getForAdmin(userId);
    const user = await this.users.restore(userId);
    await this.authorization.invalidate(userId);
    return user;
  }

  private withSocketActivity<T extends { id: string }>(
    user: T,
  ): T & {
    isActive: boolean;
  };
  private withSocketActivity<T extends { id: string }>(
    users: T[],
  ): Array<T & { isActive: boolean }>;
  private withSocketActivity<T extends { id: string }>(input: T | T[]) {
    const activeUserIds = this.locationFanout.dashboardSubscriberIds();
    const decorate = (user: T) => ({
      ...user,
      isActive: activeUserIds.has(user.id),
    });
    return Array.isArray(input) ? input.map(decorate) : decorate(input);
  }

  private handleUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      if (
        'meta' in error &&
        typeof error.meta === 'object' &&
        error.meta !== null &&
        'target' in error.meta &&
        Array.isArray(error.meta.target) &&
        error.meta.target.includes('phone')
      ) {
        throw new ConflictException(locals.auth.phone_already_in_use);
      }
      throw new ConflictException(locals.auth.email_already_registered);
    }
  }
}
