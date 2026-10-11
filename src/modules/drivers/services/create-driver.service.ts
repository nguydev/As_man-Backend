import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import type {
  AdminCreateDriverDto,
  ProviderCreateDriverDto,
  UpdateDriverProfileDto,
} from '@/modules/drivers/dto/driver.dto';
import { DriverRepository } from '@/modules/drivers/repositories/driver.repository';
import { MembershipService } from '@/modules/memberships/services/membership.service';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';
import locals from '@/locals';

type ManagedDriverDto = AdminCreateDriverDto | ProviderCreateDriverDto;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class CreateDriverService {
  constructor(
    private readonly users: UserRepository,
    private readonly drivers: DriverRepository,
    private readonly memberships: MembershipService,
    private readonly access: OrganizationAccessService,
  ) {}

  async execute(
    actorId: string,
    dto: ManagedDriverDto,
    organizationId?: string,
    options: { skipOrganizationAccessCheck?: boolean } = {},
  ) {
    if (dto.fleetId && !organizationId) {
      throw new BadRequestException(locals.drivers.fleet_requires_organization);
    }
    if (organizationId && !options.skipOrganizationAccessCheck) {
      await this.access.assertCanManage(actorId, organizationId);
    }
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException(locals.auth.email_already_registered);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let account: Awaited<ReturnType<DriverRepository['createAccount']>>;
    try {
      account = await this.drivers.createAccount({
        name: dto.name,
        email: dto.email,
        vinNumber: dto.vinNumber,
        licensePlate: dto.licensePlate,
        passwordHash,
        createdById: actorId,
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException(locals.auth.email_already_registered);
      }
      throw error;
    }

    try {
      if (organizationId) {
        await this.memberships.addDriver(
          actorId,
          organizationId,
          {
            driverId: account.driver!.id,
            fleetId: dto.fleetId,
          },
          options,
        );
      }
      return account.driver;
    } catch (error) {
      await this.drivers.deleteAccount(account.id);
      throw error;
    }
  }

  async findByOrganizationId(organizationId: string) {
    return this.drivers.findByOrganizationId(organizationId);
  }

  async findOrganizationDriver(organizationId: string, driverId: string) {
    const driver = await this.drivers.findByOrganizationAndId(
      organizationId,
      driverId,
    );
    if (!driver) {
      throw new NotFoundException(locals.drivers.driver_not_found);
    }
    return driver;
  }

  async updateOrganizationDriver(
    organizationId: string,
    driverId: string,
    dto: UpdateDriverProfileDto,
  ) {
    await this.findOrganizationDriver(organizationId, driverId);
    return this.drivers.updateById(driverId, dto);
  }

  async terminateOrganizationDriver(
    actorId: string,
    organizationId: string,
    driverId: string,
  ): Promise<void> {
    await this.findOrganizationDriver(organizationId, driverId);
    await this.memberships.removeDriverByDriverId(
      actorId,
      organizationId,
      driverId,
    );
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
