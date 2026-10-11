import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import { MembershipRepository } from '@/modules/memberships/repositories/membership.repository';

export type MapVisibilityScope = {
  organizationIds: string[] | null;
  sosOrganizationIds: string[] | null;
  allowedDriverIds: string[] | null;
};

@Injectable()
export class MapVisibilityService {
  constructor(private readonly memberships: MembershipRepository) {}

  async resolve(user: AuthenticatedUser): Promise<MapVisibilityScope> {
    if (user.authorization.role === 'ADMIN') {
      return {
        organizationIds: null,
        sosOrganizationIds: null,
        allowedDriverIds: null,
      };
    }

    const [fleetRows, sosRows] = await Promise.all([
      this.memberships.activeOrganizationIdsForUser(user.sub, [
        'OWNER',
        'PROVIDER',
        'DRIVER',
      ]),
      this.memberships.activeOrganizationIdsForUser(user.sub, [
        'OWNER',
        'PROVIDER',
      ]),
    ]);

    const organizationIds = [
      ...new Set(fleetRows.map((row) => row.organizationId)),
    ];
    const sosOrganizationIds = [
      ...new Set(sosRows.map((row) => row.organizationId)),
    ];
    const driverRows =
      await this.memberships.activeDriverIdsInOrganizations(organizationIds);
    const allowedDriverIds = driverRows
      .map((row) => row.driverId)
      .filter((id): id is string => Boolean(id));

    return { organizationIds, sosOrganizationIds, allowedDriverIds };
  }
}
