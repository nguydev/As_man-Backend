import { ForbiddenException, Injectable } from '@nestjs/common';
import type { OrganizationMemberRole } from '@prisma-client';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { MembershipRepository } from '@/modules/memberships/repositories/membership.repository';
import locals from '@/locals';

@Injectable()
export class OrganizationAccessService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  async assertRoles(
    userId: string,
    organizationId: string,
    roles: OrganizationMemberRole[],
  ): Promise<void> {
    const [user, organizationActive] = await Promise.all([
      this.users.findById(userId),
      this.memberships.isOrganizationActive(organizationId),
    ]);
    if (!user || user.status !== 'ACTIVE' || !organizationActive) {
      throw new ForbiddenException(
        locals.memberships.organization_access_denied,
      );
    }
    if (user.role === 'ADMIN') return;

    if (
      await this.memberships.hasOrganizationRole(userId, organizationId, roles)
    ) {
      return;
    }
    throw new ForbiddenException(locals.memberships.organization_access_denied);
  }

  assertCanManage(userId: string, organizationId: string): Promise<void> {
    return this.assertRoles(userId, organizationId, ['OWNER', 'PROVIDER']);
  }
}
