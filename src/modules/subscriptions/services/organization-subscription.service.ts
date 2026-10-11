import { Injectable } from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';
import { SubscriptionRepository } from '@/modules/subscriptions/repositories/subscription.repository';

@Injectable()
export class OrganizationSubscriptionService {
  constructor(
    private readonly access: OrganizationAccessService,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async list(userId: string, organizationId: string, pagination: Pagination) {
    await this.access.assertCanManage(userId, organizationId);
    return this.subscriptions.listForOrganization(organizationId, pagination);
  }
}
