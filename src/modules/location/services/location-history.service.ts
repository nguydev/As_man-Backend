import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationRepository } from '@/modules/location/repositories/location.repository';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';
import locals from '@/locals';

@Injectable()
export class LocationHistoryService {
  constructor(
    private readonly locations: LocationRepository,
    private readonly access: OrganizationAccessService,
  ) {}

  async list(
    userId: string,
    organizationId: string,
    driverId: string,
    since: Date,
  ) {
    await this.access.assertCanManage(userId, organizationId);
    if (
      !(await this.locations.driverInOrganization(driverId, organizationId))
    ) {
      throw new NotFoundException(locals.drivers.driver_not_found);
    }
    return this.locations.history(driverId, since);
  }
}
