import { Injectable } from '@nestjs/common';
import type {
  IncidentAlertStatus,
  IncidentAlertType,
  Prisma,
} from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

const INCIDENT_INCLUDE = {
  driver: {
    include: {
      user: { include: { profile: true } },
      organizationMembers: {
        where: { role: 'DRIVER', status: 'ACTIVE' },
        select: {
          organizationId: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  },
  case: {
    include: {
      attorney: {
        select: { id: true, name: true, avatarUrl: true, email: true },
      },
    },
  },
  triggeredBy: { select: { id: true, email: true, profile: true } },
  acknowledgedBy: { select: { id: true, email: true, profile: true } },
} satisfies Prisma.IncidentAlertInclude;

export interface ListIncidentFilters {
  organizationId?: string;
  status?: IncidentAlertStatus;
  type?: IncidentAlertType;
  driverId?: string;
}

export interface CreateIncidentCaseInput {
  incidentId: string;
  attorneyId: string;
  actorId: string;
  court?: string;
  hearingDate?: Date;
  summary?: string;
}

export class IncidentCaseAlreadyLinkedError extends Error {}

export type SosIncident = Prisma.IncidentAlertGetPayload<{
  include: typeof INCIDENT_INCLUDE;
}>;

@Injectable()
export class SosRepository {
  constructor(private readonly prisma: PrismaService) {}
  driver(userId: string) {
    return this.prisma.driver.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
  }
  createContact(data: Prisma.EmergencyContactUncheckedCreateInput) {
    return this.prisma.emergencyContact.create({ data });
  }
  contacts(driverId: string, pagination: Pagination) {
    return prismaPaginate(
      this.prisma.emergencyContact,
      { where: { driverId }, orderBy: { priority: 'asc' } },
      pagination,
      {
        sortFields: ['priority', 'name', 'createdAt', 'updatedAt'],
        defaultSortField: 'priority',
        defaultSortDirection: 'asc',
      },
    );
  }
  notificationContacts(driverId: string) {
    return this.prisma.emergencyContact.findMany({
      where: { driverId },
      orderBy: { priority: 'asc' },
    });
  }
  contact(id: string) {
    return this.prisma.emergencyContact.findUnique({ where: { id } });
  }
  updateContact(id: string, data: Prisma.EmergencyContactUpdateInput) {
    return this.prisma.emergencyContact.update({ where: { id }, data });
  }
  removeContact(id: string) {
    return this.prisma.emergencyContact.delete({ where: { id } });
  }
  createIncident(data: Prisma.IncidentAlertUncheckedCreateInput) {
    return this.prisma.incidentAlert.create({
      data,
      include: INCIDENT_INCLUDE,
    });
  }

  listIncidents(pagination: Pagination, filters: ListIncidentFilters) {
    return prismaPaginate(
      this.prisma.incidentAlert,
      {
        where: {
          status: filters.status,
          type: filters.type,
          driverId: filters.driverId,
          ...(filters.organizationId && {
            driver: {
              organizationMembers: {
                some: {
                  organizationId: filters.organizationId,
                  role: 'DRIVER',
                  status: 'ACTIVE',
                },
              },
            },
          }),
        },
        include: INCIDENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['createdAt', 'updatedAt', 'status', 'type'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  incident(id: string) {
    return this.prisma.incidentAlert.findUnique({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
  }

  acknowledgeIncident(id: string, userId: string) {
    return this.prisma.incidentAlert.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
      include: INCIDENT_INCLUDE,
    });
  }

  resolveIncident(id: string, userId: string, acknowledge: boolean) {
    const now = new Date();
    return this.prisma.incidentAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        ...(acknowledge && {
          acknowledgedById: userId,
          acknowledgedAt: now,
        }),
        resolvedAt: now,
      },
      include: INCIDENT_INCLUDE,
    });
  }

  createCaseFromIncident(input: CreateIncidentCaseInput) {
    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incidentAlert.findUnique({
        where: { id: input.incidentId },
        select: { driverId: true, caseId: true },
      });
      if (!incident || incident.caseId) return null;

      const row = await tx.case.create({
        data: {
          attorneyId: input.attorneyId,
          driverId: incident.driverId,
          court: input.court,
          hearingDate: input.hearingDate,
          summary: input.summary,
          createdById: input.actorId,
        },
      });
      await tx.caseStatusHistory.create({
        data: {
          caseId: row.id,
          fromStatus: null,
          toStatus: row.status,
          changedById: input.actorId,
          reason: 'Case created from SOS incident',
        },
      });

      const linked = await tx.incidentAlert.updateMany({
        where: { id: input.incidentId, caseId: null },
        data: { caseId: row.id },
      });
      if (linked.count !== 1) throw new IncidentCaseAlreadyLinkedError();

      return tx.incidentAlert.findUnique({
        where: { id: input.incidentId },
        include: INCIDENT_INCLUDE,
      });
    });
  }
}
