import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  SOS_JOB_NOTIFY,
  SOS_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import { LocationFanoutService } from '@/modules/location/services/location-fanout.service';
import { LocationMembershipService } from '@/modules/location/services/location-membership.service';
import type {
  CreateEmergencyContactDto,
  CreateIncidentCaseDto,
  ListSosIncidentsDto,
  TriggerSosDto,
  UpdateEmergencyContactDto,
} from '@/modules/sos/dto/sos.dto';
import { AttorneyRepository } from '@/modules/attorneys/repositories/attorney.repository';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';
import {
  IncidentCaseAlreadyLinkedError,
  type SosIncident,
  SosRepository,
} from '@/modules/sos/repositories/sos.repository';
import locals from '@/locals';
@Injectable()
export class SosService {
  constructor(
    private readonly sos: SosRepository,
    private readonly memberships: LocationMembershipService,
    private readonly fanout: LocationFanoutService,
    private readonly attorneys: AttorneyRepository,
    private readonly notifications: NotificationService,
    @InjectQueue(SOS_QUEUE) private readonly queue: Queue,
  ) {}
  async createContact(userId: string, dto: CreateEmergencyContactDto) {
    const driver = await this.driver(userId);
    return this.sos.createContact({ ...dto, driverId: driver.id });
  }
  async contacts(userId: string, pagination: Pagination) {
    return this.sos.contacts((await this.driver(userId)).id, pagination);
  }
  async updateContact(
    userId: string,
    id: string,
    dto: UpdateEmergencyContactDto,
  ) {
    const driver = await this.driver(userId);
    const contact = await this.sos.contact(id);
    if (!contact || contact.driverId !== driver.id)
      throw new NotFoundException(locals.sos.contact_not_found);
    return this.sos.updateContact(id, dto);
  }
  async removeContact(userId: string, id: string) {
    const driver = await this.driver(userId);
    const contact = await this.sos.contact(id);
    if (!contact || contact.driverId !== driver.id)
      throw new NotFoundException(locals.sos.contact_not_found);
    return this.sos.removeContact(id);
  }
  async trigger(userId: string, dto: TriggerSosDto) {
    const driver = await this.driver(userId);
    const incident = await this.sos.createIncident({
      driverId: driver.id,
      triggeredById: userId,
      type: 'SOS',
      ...dto,
    });
    const organizationIds = await this.memberships.activeOrganizationIds(
      driver.id,
    );
    const payload = {
      ...this.withUiFields(incident),
      organizationIds,
    };
    this.fanout.sos(organizationIds, payload);
    await this.queue.add(SOS_JOB_NOTIFY, {
      driverId: driver.id,
      incidentId: incident.id,
      ...dto,
    });

    const notify = {
      title: locals.notifications.sos_title,
      body: locals.notifications.sos_body,
      data: {
        type: 'SOS',
        incidentId: incident.id,
        driverId: driver.id,
      },
      channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
    };
    await this.notifications.notifySystem(notify);
    await Promise.all(
      organizationIds.map((organizationId) =>
        this.notifications.notifyOrganization(organizationId, {
          ...notify,
          data: { ...notify.data, organizationId },
        }),
      ),
    );

    return incident;
  }

  async adminIncidents(pagination: Pagination, filters: ListSosIncidentsDto) {
    const result = await this.sos.listIncidents(pagination, filters);
    return {
      ...result,
      data: result.data.map((incident) =>
        this.withUiFields(incident as SosIncident),
      ),
    };
  }

  async adminIncident(id: string) {
    return this.withUiFields(await this.incident(id));
  }

  organizationIncidents(
    organizationId: string,
    pagination: Pagination,
    filters: ListSosIncidentsDto,
  ) {
    return this.adminIncidents(pagination, { ...filters, organizationId });
  }

  async adminAcknowledgeIncident(userId: string, id: string) {
    const incident = await this.incident(id);
    if (incident.status !== 'OPEN') return this.withUiFields(incident);
    const updated = await this.sos.acknowledgeIncident(id, userId);
    if (incident.triggeredById) {
      await this.notifications.notifyUser(incident.triggeredById, {
        title: locals.notifications.sos_acknowledged_title,
        body: locals.notifications.sos_acknowledged_body,
        data: { type: 'SOS_ACKNOWLEDGED', incidentId: id },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
    return this.withUiFields(updated);
  }

  async adminResolveIncident(userId: string, id: string) {
    const incident = await this.incident(id);
    if (incident.status === 'RESOLVED') return this.withUiFields(incident);
    const updated = await this.sos.resolveIncident(
      id,
      userId,
      incident.status === 'OPEN',
    );
    if (incident.triggeredById) {
      await this.notifications.notifyUser(incident.triggeredById, {
        title: locals.notifications.sos_resolved_title,
        body: locals.notifications.sos_resolved_body,
        data: { type: 'SOS_RESOLVED', incidentId: id },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
    return this.withUiFields(updated);
  }

  async adminCreateCaseFromIncident(
    userId: string,
    id: string,
    dto: CreateIncidentCaseDto,
  ) {
    const incident = await this.incident(id);
    if (incident.caseId) {
      throw new ConflictException(locals.sos.incident_case_exists);
    }
    const attorney = await this.attorneys.find(dto.attorneyId);
    if (!attorney) {
      throw new NotFoundException(locals.attorneys.not_found);
    }
    const courts = attorney.courts ?? [];
    if (dto.court && courts.length > 0 && !courts.includes(dto.court)) {
      throw new BadRequestException(
        'Court must be one of the selected attorney courts',
      );
    }

    let updated: SosIncident | null;
    try {
      updated = await this.sos.createCaseFromIncident({
        incidentId: id,
        attorneyId: dto.attorneyId,
        actorId: userId,
        court: dto.court,
        hearingDate: dto.hearingDate ? new Date(dto.hearingDate) : undefined,
        summary: dto.summary ?? incident.message ?? undefined,
      });
    } catch (error) {
      if (error instanceof IncidentCaseAlreadyLinkedError) {
        throw new ConflictException(locals.sos.incident_case_exists);
      }
      throw error;
    }
    if (!updated) throw new ConflictException(locals.sos.incident_case_exists);
    return this.withUiFields(updated);
  }

  private async driver(userId: string) {
    const driver = await this.sos.driver(userId);
    if (!driver) throw new NotFoundException(locals.drivers.driver_not_found);
    return driver;
  }

  private async incident(id: string) {
    const incident = await this.sos.incident(id);
    if (!incident) throw new NotFoundException(locals.sos.incident_not_found);
    return incident;
  }

  private withUiFields(incident: SosIncident) {
    return {
      ...incident,
      organizationIds: incident.driver.organizationMembers.map(
        (member) => member.organizationId,
      ),
      assignedAttorney: incident.case?.attorney ?? null,
      timeline: [
        {
          type: 'RECEIVED',
          message: locals.sos.timeline_received,
          at: incident.createdAt,
        },
        ...(incident.acknowledgedAt
          ? [
              {
                type: 'ACKNOWLEDGED',
                message: locals.sos.timeline_acknowledged,
                at: incident.acknowledgedAt,
              },
            ]
          : []),
        ...(incident.resolvedAt
          ? [
              {
                type: 'RESOLVED',
                message: locals.sos.timeline_resolved,
                at: incident.resolvedAt,
              },
            ]
          : []),
      ],
    };
  }
}
