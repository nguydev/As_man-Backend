import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RedisAdapter } from '@/infrastructure/redis/redis.adapter';
import type { AddDriverMembershipDto } from '@/modules/memberships/dto/add-driver-membership.dto';
import { MembershipRepository } from '@/modules/memberships/repositories/membership.repository';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';
import locals from '@/locals';

@Injectable()
export class MembershipService {
  constructor(
    private readonly access: OrganizationAccessService,
    private readonly memberships: MembershipRepository,
    private readonly redis: RedisAdapter,
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications: NotificationService,
  ) {}

  async addDriver(
    actorId: string,
    organizationId: string,
    dto: AddDriverMembershipDto,
    options: { skipOrganizationAccessCheck?: boolean } = {},
  ) {
    if (!options.skipOrganizationAccessCheck) {
      await this.access.assertCanManage(actorId, organizationId);
    }
    const result = await this.memberships.addDriver(
      organizationId,
      dto.driverId,
      actorId,
      dto.fleetId,
    );

    if (result.kind === 'driver_not_found') {
      throw new NotFoundException(locals.memberships.driver_not_found);
    }
    if (result.kind === 'fleet_not_found') {
      throw new NotFoundException(locals.memberships.fleet_not_found);
    }
    if (result.kind === 'subscription_required') {
      throw new ConflictException(locals.memberships.subscription_required);
    }
    if (result.kind === 'driver_limit_reached') {
      throw new ConflictException(locals.memberships.driver_limit_reached);
    }

    await this.invalidateDriverOrganizations(dto.driverId);
    if (result.membership.userId) {
      await this.notifications.notifyUser(result.membership.userId, {
        title: locals.notifications.membership_added_title,
        body: locals.notifications.membership_added_body,
        data: {
          type: 'MEMBERSHIP_ADDED',
          organizationId,
          driverId: dto.driverId,
        },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
    return result.membership;
  }

  async removeDriver(
    actorId: string,
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    await this.access.assertCanManage(actorId, organizationId);
    const removed = await this.memberships.removeDriver(
      membershipId,
      organizationId,
    );
    if (!removed) {
      throw new NotFoundException(locals.memberships.membership_not_found);
    }
    await this.invalidateDriverOrganizations(removed.driverId);
    if (removed.userId) {
      await this.notifications.notifyUser(removed.userId, {
        title: locals.notifications.membership_removed_title,
        body: locals.notifications.membership_removed_body,
        data: {
          type: 'MEMBERSHIP_REMOVED',
          organizationId,
          driverId: removed.driverId,
        },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
  }

  async removeDriverByDriverId(
    actorId: string,
    organizationId: string,
    driverId: string,
  ): Promise<void> {
    await this.access.assertCanManage(actorId, organizationId);
    const removed = await this.memberships.removeDriverByDriverId(
      driverId,
      organizationId,
    );
    if (!removed) {
      throw new NotFoundException(locals.memberships.membership_not_found);
    }
    await this.invalidateDriverOrganizations(removed.driverId);
    if (removed.userId) {
      await this.notifications.notifyUser(removed.userId, {
        title: locals.notifications.membership_removed_title,
        body: locals.notifications.membership_removed_body,
        data: {
          type: 'MEMBERSHIP_REMOVED',
          organizationId,
          driverId: removed.driverId,
        },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
  }

  private async invalidateDriverOrganizations(driverId: string): Promise<void> {
    const client = await this.redis.getClient();
    await client
      .multi()
      .incr(`driver:${driverId}:orgs:version`)
      .del(`driver:${driverId}:orgs`)
      .exec();
  }
}
