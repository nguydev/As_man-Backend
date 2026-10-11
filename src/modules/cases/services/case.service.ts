import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CaseStatus } from '@prisma-client';
import type { Pagination } from '@/common/pagination/pagination.types';
import { format } from '@/common/utils/format.util';
import type {
  CreateCaseDto,
  ListCasesDto,
  UpdateCaseDto,
  UpdateCaseStatusDto,
} from '@/modules/cases/dto/case.dto';
import { CaseRepository } from '@/modules/cases/repositories/case.repository';
import { AttorneyRepository } from '@/modules/attorneys/repositories/attorney.repository';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';
import locals from '@/locals';

type CaseTrackerTimelineItem = {
  id: string;
  type: 'STATUS' | 'HEARING';
  at: Date;
  fromStatus?: CaseStatus | null;
  toStatus?: CaseStatus;
  reason?: string | null;
  actor?: unknown;
  court?: string | null;
};

export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED', 'ARCHIVED'],
  IN_PROGRESS: ['HEARING', 'CLOSED', 'CANCELLED', 'ARCHIVED'],
  HEARING: ['IN_PROGRESS', 'CLOSED', 'CANCELLED'],
  CLOSED: ['REOPENED', 'ARCHIVED'],
  CANCELLED: ['REOPENED', 'ARCHIVED'],
  REOPENED: ['IN_PROGRESS', 'HEARING', 'CLOSED', 'CANCELLED'],
  ARCHIVED: [],
};
@Injectable()
export class CaseService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly attorneys: AttorneyRepository,
    private readonly notifications: NotificationService,
  ) {}
  async create(actorId: string, dto: CreateCaseDto) {
    if (!(await this.attorneys.find(dto.attorneyId)))
      throw new NotFoundException(locals.attorneys.not_found);
    if (!(await this.cases.findDriver(dto.driverId))) {
      throw new NotFoundException(locals.drivers.driver_not_found);
    }
    const row = await this.cases.create({
      attorneyId: dto.attorneyId,
      actorId,
      driverId: dto.driverId,
      court: dto.court,
      hearingDate: dto.hearingDate ? new Date(dto.hearingDate) : undefined,
      summary: dto.summary,
    });
    const driverUserId = row?.driver?.userId;
    if (driverUserId) {
      await this.notifications.notifyUser(driverUserId, {
        title: locals.notifications.case_created_title,
        body: locals.notifications.case_created_body,
        data: { type: 'CASE_CREATED', caseId: row.id },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
    return row;
  }
  list(pagination: Pagination, filters: ListCasesDto = {}) {
    return this.cases.list(pagination, {
      status: filters.status,
      search: filters.search,
      attorneyId: filters.attorneyId,
    });
  }

  listForOrganization(
    organizationId: string,
    pagination: Pagination,
    filters: ListCasesDto = {},
  ) {
    return this.cases.list(pagination, {
      status: filters.status,
      search: filters.search,
      attorneyId: filters.attorneyId,
      organizationId,
    });
  }
  stats() {
    return this.cases.stats();
  }
  async get(id: string) {
    const row = await this.cases.find(id);
    if (!row) throw new NotFoundException(locals.cases.not_found);
    return row;
  }

  async tracker(id: string) {
    const row = await this.get(id);
    const timeline: CaseTrackerTimelineItem[] = row.statusHistory.length
      ? row.statusHistory.map((item) => ({
          id: item.id,
          type: 'STATUS',
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
          reason: item.reason,
          at: item.changedAt,
          actor: item.changedBy ?? null,
        }))
      : [
          {
            id: 'created',
            type: 'STATUS',
            fromStatus: null,
            toStatus: CaseStatus.OPEN,
            reason: 'Case created',
            at: row.createdAt,
            actor: null,
          },
        ];

    if (row.hearingDate) {
      timeline.push({
        id: `${row.id}:hearing`,
        type: 'HEARING',
        court: row.court,
        at: row.hearingDate,
      });
    }

    return {
      id: row.id,
      status: row.status,
      outcome: row.outcome,
      court: row.court,
      hearingDate: row.hearingDate,
      summary: row.summary,
      attorney: row.attorney,
      driver: row.driver,
      documents: row.vaultDocs,
      progress: this.progress(row.status),
      allowedTransitions: CASE_STATUS_TRANSITIONS[row.status],
      timeline: timeline.sort((a, b) => a.at.getTime() - b.at.getTime()),
    };
  }

  async update(id: string, dto: UpdateCaseDto) {
    const row = await this.get(id);
    if (dto.attorneyId && !(await this.attorneys.find(dto.attorneyId))) {
      throw new NotFoundException(locals.attorneys.not_found);
    }
    if (dto.driverId && !(await this.cases.findDriver(dto.driverId))) {
      throw new NotFoundException(locals.drivers.driver_not_found);
    }
    if (dto.court) {
      const attorney = await this.attorneys.find(dto.attorneyId ?? row.attorneyId);
      const courts = attorney?.courts ?? [];
      if (courts.length > 0 && !courts.includes(dto.court)) {
        throw new BadRequestException(
          'Court must be one of the selected attorney courts',
        );
      }
    }
    return this.cases.update(id, {
      attorneyId: dto.attorneyId,
      driverId: dto.driverId,
      court: dto.court,
      hearingDate:
        dto.hearingDate === undefined
          ? undefined
          : dto.hearingDate === null
            ? null
            : new Date(dto.hearingDate),
      summary: dto.summary,
    });
  }

  async changeStatus(id: string, actorId: string, dto: UpdateCaseStatusDto) {
    const row = await this.get(id);
    if (!CASE_STATUS_TRANSITIONS[row.status].includes(dto.status))
      throw new BadRequestException(locals.cases.invalid_transition);
    if (dto.status === CaseStatus.CLOSED && !dto.outcome) {
      throw new BadRequestException(locals.cases.outcome_required);
    }
    const outcome =
      dto.status === CaseStatus.CLOSED
        ? dto.outcome
        : dto.status === CaseStatus.ARCHIVED
          ? row.outcome
          : null;
    const updated = await this.cases.changeStatus(
      id,
      dto.status,
      actorId,
      outcome,
      dto.reason,
    );
    const driverUserId = row.driver?.userId;
    if (driverUserId) {
      await this.notifications.notifyUser(driverUserId, {
        title: locals.notifications.case_status_title,
        body: format(locals.notifications.case_status_body, {
          status: dto.status,
        }),
        data: {
          type: 'CASE_STATUS',
          caseId: id,
          status: dto.status,
        },
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    }
    return updated;
  }

  private progress(status: CaseStatus) {
    const steps: CaseStatus[] = [
      CaseStatus.OPEN,
      CaseStatus.IN_PROGRESS,
      CaseStatus.HEARING,
      CaseStatus.CLOSED,
    ];
    const mappedStatus =
      status === CaseStatus.ARCHIVED
        ? CaseStatus.CLOSED
        : status === CaseStatus.REOPENED
          ? CaseStatus.IN_PROGRESS
          : status === CaseStatus.CANCELLED
            ? null
            : status;
    const index =
      mappedStatus === null ? -1 : steps.indexOf(mappedStatus as CaseStatus);
    return steps.map((step, stepIndex) => ({
      status: step,
      completed:
        status === CaseStatus.ARCHIVED ||
        status === CaseStatus.CLOSED ||
        (index >= 0 && stepIndex < index),
      active:
        status === CaseStatus.CANCELLED
          ? false
          : status === CaseStatus.REOPENED
            ? step === CaseStatus.IN_PROGRESS
            : step === status ||
              (status === CaseStatus.ARCHIVED && step === CaseStatus.CLOSED),
    }));
  }
}
