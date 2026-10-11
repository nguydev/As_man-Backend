import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrganizationStatus } from '@prisma-client';
import type { Pagination } from '@/common/pagination/pagination.types';
import { format } from '@/common/utils/format.util';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { MAILER_PORT } from '@/infrastructure/mailer/mailer.constants';
import type {
  MailerPort,
  MailMessage,
} from '@/infrastructure/mailer/mailer.types';
import locals from '@/locals';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
} from '@/modules/organizations/dto/create-organization.dto';
import type { Prisma } from '@prisma-client';
import { OrganizationRepository } from '@/modules/organizations/repositories/organization.repository';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { DeliveryChannelDto } from '@/modules/notifications/types/notification.types';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: UserRepository,
    private readonly notifications: NotificationService,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  async create(actorId: string, dto: CreateOrganizationDto) {
    const owner = await this.users.findById(dto.ownerUserId);
    if (!owner || owner.status !== 'ACTIVE') {
      throw new NotFoundException(locals.organizations.owner_not_found);
    }

    const organization = await this.organizations.createWithOwner({
      ...dto,
      createdById: actorId,
    });

    await this.notifications.notifySystem({
      title: locals.notifications.organization_pending_title,
      body: format(locals.notifications.organization_pending_body, {
        organization: organization.name,
      }),
      data: {
        type: 'ORGANIZATION_PENDING',
        organizationId: organization.id,
      },
      channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
    });

    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const target = await this.organizations.findStatusTarget(id);
    if (!target) {
      throw new NotFoundException(locals.organizations.not_found);
    }

    const data: Prisma.OrganizationUpdateInput = {
      name: dto.name,
      email: dto.email,
      region: dto.region,
      logoUrl: dto.logoUrl,
    };

    if (dto.address) {
      data.address = {
        upsert: {
          create: dto.address,
          update: dto.address,
        },
      };
    }

    return this.organizations.update(id, data);
  }

  async list(userId: string, pagination: Pagination) {
    const user = await this.users.findById(userId);
    if (user?.role === 'ADMIN' && user.status === 'ACTIVE') {
      return this.organizations.listAll(pagination);
    }
    return this.organizations.listForMember(userId, pagination);
  }

  async getById(id: string) {
    const organization = await this.organizations.findById(id);
    if (!organization) {
      throw new NotFoundException(locals.organizations.not_found);
    }
    return organization;
  }

  stats() {
    return this.organizations.stats();
  }

  async updateStatus(
    id: string,
    actorId: string,
    dto: UpdateOrganizationStatusDto,
  ) {
    const target = await this.organizations.findStatusTarget(id);
    if (!target) {
      throw new NotFoundException(locals.organizations.not_found);
    }
    if (
      (dto.status === 'REJECTED' || dto.status === 'SUSPENDED') &&
      !dto.reason
    ) {
      throw new BadRequestException(locals.organizations.reason_required);
    }

    const reason =
      dto.status === 'REJECTED' || dto.status === 'SUSPENDED'
        ? dto.reason!
        : null;
    const approvedById =
      dto.status === 'ACTIVE'
        ? actorId
        : dto.status === 'PENDING' || dto.status === 'REJECTED'
          ? null
          : undefined;
    const organization = await this.organizations.updateStatus(
      id,
      dto.status,
      reason,
      approvedById,
    );
    const recipient = target.email ?? target.members[0]?.user.email;
    if (recipient) {
      await this.mailer.send({
        to: recipient,
        ...this.statusMail(dto.status, target.name, reason),
      });
    }

    const notify = this.statusNotify(dto.status, target.name, reason);
    const data = {
      type: `ORGANIZATION_${dto.status}`,
      organizationId: id,
      status: dto.status,
    };
    if (dto.status === 'ACTIVE') {
      await this.notifications.notifyOrganization(id, {
        ...notify,
        data,
        channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
      });
    } else {
      await Promise.all(
        target.members.map((member) =>
          this.notifications.notifyUser(member.userId, {
            ...notify,
            data,
            channels: [DeliveryChannelDto.IN_APP, DeliveryChannelDto.PUSH],
          }),
        ),
      );
    }

    return organization;
  }

  private statusNotify(
    status: OrganizationStatus,
    organization: string,
    reason: string | null,
  ) {
    const params = { organization, reason: reason ?? '' };
    switch (status) {
      case 'ACTIVE':
        return {
          title: locals.notifications.organization_active_title,
          body: format(locals.notifications.organization_active_body, params),
        };
      case 'REJECTED':
        return {
          title: locals.notifications.organization_rejected_title,
          body: format(locals.notifications.organization_rejected_body, params),
        };
      case 'SUSPENDED':
        return {
          title: locals.notifications.organization_suspended_title,
          body: format(
            locals.notifications.organization_suspended_body,
            params,
          ),
        };
      case 'PENDING':
        return {
          title: locals.notifications.organization_status_pending_title,
          body: format(
            locals.notifications.organization_status_pending_body,
            params,
          ),
        };
    }
  }

  private statusMail(
    status: OrganizationStatus,
    organization: string,
    reason: string | null,
  ): Pick<MailMessage, 'subject' | 'text'> {
    const params = { organization, reason: reason ?? '' };
    switch (status) {
      case 'ACTIVE':
        return {
          subject: locals.organizations.status_email_active_subject,
          text: format(locals.organizations.status_email_active_body, params),
        };
      case 'REJECTED':
        return {
          subject: locals.organizations.status_email_rejected_subject,
          text: format(locals.organizations.status_email_rejected_body, params),
        };
      case 'SUSPENDED':
        return {
          subject: locals.organizations.status_email_suspended_subject,
          text: format(
            locals.organizations.status_email_suspended_body,
            params,
          ),
        };
      case 'PENDING':
        return {
          subject: locals.organizations.status_email_pending_subject,
          text: format(locals.organizations.status_email_pending_body, params),
        };
    }
  }
}
