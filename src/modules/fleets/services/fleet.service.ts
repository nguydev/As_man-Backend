import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import locals from '@/locals';
import type {
  AssignFleetDriverDto,
  CreateFleetDto,
  UpdateFleetDto,
} from '@/modules/fleets/dto/fleet.dto';
import { FleetRepository } from '@/modules/fleets/repositories/fleet.repository';

@Injectable()
export class FleetService {
  constructor(private readonly fleets: FleetRepository) {}

  async list(organizationId: string) {
    const fleets = await this.fleets.listByOrganization(organizationId);
    return fleets.map((fleet) => this.mapFleetSummary(fleet));
  }

  async get(organizationId: string, fleetId: string) {
    const fleet = await this.fleets.findByOrganizationAndId(
      organizationId,
      fleetId,
    );
    if (!fleet) throw new NotFoundException(locals.fleets.not_found);
    return this.mapFleetDetail(fleet);
  }

  async create(actorId: string, organizationId: string, dto: CreateFleetDto) {
    const existing = await this.fleets.findByOrganizationAndName(
      organizationId,
      dto.name,
    );
    if (existing) throw new ConflictException(locals.fleets.name_taken);
    const fleet = await this.fleets.create({
      organizationId,
      name: dto.name,
      color: dto.color ?? '#16a34a',
      createdById: actorId,
    });
    return this.mapFleetSummary(fleet);
  }

  async update(organizationId: string, fleetId: string, dto: UpdateFleetDto) {
    const fleet = await this.fleets.findByOrganizationAndId(
      organizationId,
      fleetId,
    );
    if (!fleet) throw new NotFoundException(locals.fleets.not_found);
    if (dto.name && dto.name !== fleet.name) {
      const existing = await this.fleets.findByOrganizationAndName(
        organizationId,
        dto.name,
      );
      if (existing && existing.id !== fleetId) {
        throw new ConflictException(locals.fleets.name_taken);
      }
    }
    const updated = await this.fleets.update(fleetId, {
      name: dto.name ?? fleet.name,
      color: dto.color ?? fleet.color,
    });
    return this.mapFleetSummary(updated);
  }

  async remove(organizationId: string, fleetId: string) {
    const fleet = await this.fleets.findByOrganizationAndId(
      organizationId,
      fleetId,
    );
    if (!fleet) throw new NotFoundException(locals.fleets.not_found);
    await this.fleets.delete(fleetId);
  }

  async assignDriver(
    actorId: string,
    organizationId: string,
    fleetId: string,
    dto: AssignFleetDriverDto,
  ) {
    const fleet = await this.fleets.findByOrganizationAndId(
      organizationId,
      fleetId,
    );
    if (!fleet) throw new NotFoundException(locals.fleets.not_found);

    const membership = await this.fleets.findActiveDriverMembership(
      organizationId,
      dto.driverId,
    );
    if (!membership) {
      throw new NotFoundException(locals.memberships.driver_not_found);
    }

    await this.fleets.assignDriver({
      fleetId,
      organizationMemberId: membership.id,
      createdById: actorId,
    });
    return this.get(organizationId, fleetId);
  }

  async removeDriver(
    organizationId: string,
    fleetId: string,
    driverId: string,
  ) {
    const fleet = await this.fleets.findByOrganizationAndId(
      organizationId,
      fleetId,
    );
    if (!fleet) throw new NotFoundException(locals.fleets.not_found);

    const membership = await this.fleets.findActiveDriverMembership(
      organizationId,
      driverId,
    );
    if (!membership) {
      throw new NotFoundException(locals.memberships.driver_not_found);
    }

    await this.fleets.removeDriver(fleetId, membership.id);
    return this.get(organizationId, fleetId);
  }

  private mapFleetSummary(fleet: {
    id: string;
    name: string;
    color: string;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { members: number };
  }) {
    return {
      id: fleet.id,
      name: fleet.name,
      color: fleet.color,
      organizationId: fleet.organizationId,
      createdAt: fleet.createdAt,
      updatedAt: fleet.updatedAt,
      memberCount: fleet._count?.members ?? 0,
    };
  }

  private mapFleetDetail(
    fleet: Awaited<ReturnType<FleetRepository['findByOrganizationAndId']>>,
  ) {
    if (!fleet) return null;
    return {
      ...this.mapFleetSummary(fleet),
      members: (fleet.members ?? []).map((m) => {
        const driver = m.organizationMember?.driver;
        return {
          membershipId: m.id,
          organizationMemberId: m.organizationMemberId,
          driverId: driver?.id ?? null,
          name: driver?.user?.profile?.name ?? null,
          email: driver?.user?.email ?? null,
          avatar: driver?.user?.profile?.avatarUrl ?? null,
          vinNumber: driver?.vinNumber ?? null,
          licensePlate: driver?.licensePlate ?? null,
          joinedAt: m.joinedAt,
        };
      }),
    };
  }
}
