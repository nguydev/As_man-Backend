import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';
import { MAILER_PORT } from '@/infrastructure/mailer/mailer.constants';
import type { MailerPort } from '@/infrastructure/mailer/mailer.types';
import type {
  ListEmailDispatchesDto,
  SendTemplateEmailDto,
} from '@/modules/templates/dto/template.dto';
import { EmailDispatchRepository } from '@/modules/templates/repositories/email-dispatch.repository';
import { TemplateRepository } from '@/modules/templates/repositories/template.repository';
import { markdownToEmailHtml } from '@/modules/templates/utils/markdown-to-email-html';
import locals from '@/locals';

@Injectable()
export class TemplateSendService {
  constructor(
    private readonly templates: TemplateRepository,
    private readonly dispatches: EmailDispatchRepository,
    private readonly prisma: PrismaService,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  async send(actorId: string, dto: SendTemplateEmailDto) {
    const template = await this.templates.find(dto.templateId);
    if (!template) throw new NotFoundException(locals.templates.not_found);

    const recipient = await this.resolveRecipient(dto);
    const bodyMarkdown = (dto.content ?? template.content).trim();
    const subject = (dto.subject ?? template.title).trim();
    const bodyHtml = markdownToEmailHtml(bodyMarkdown);

    const dispatch = await this.dispatches.create({
      templateId: template.id,
      templateTitle: template.title,
      recipientType: dto.recipientType,
      recipientUserId: recipient.userId,
      recipientOrganizationId: recipient.organizationId,
      toEmail: recipient.toEmail,
      subject,
      bodyMarkdown,
      bodyHtml,
      sentById: actorId,
    });

    await this.mailer.send({
      to: recipient.toEmail,
      subject,
      text: bodyMarkdown,
      html: bodyHtml,
      dispatchId: dispatch.id,
    });

    return dispatch;
  }

  list(pagination: Pagination, filters: ListEmailDispatchesDto) {
    return this.dispatches.list(pagination, {
      search: filters.search,
      status: filters.status,
      recipientType: filters.recipientType,
    });
  }

  async get(id: string) {
    const row = await this.dispatches.find(id);
    if (!row) throw new NotFoundException(locals.templates.dispatch_not_found);
    return row;
  }

  private async resolveRecipient(dto: SendTemplateEmailDto) {
    if (dto.recipientType === 'USER') {
      if (!dto.userId) {
        throw new BadRequestException(locals.templates.recipient_required);
      }
      const user = await this.prisma.user.findFirst({
        where: { id: dto.userId, isDeleted: false },
        select: {
          id: true,
          email: true,
          profile: { select: { name: true } },
        },
      });
      if (!user)
        throw new NotFoundException(locals.templates.recipient_not_found);
      if (!user.email) {
        throw new BadRequestException(locals.templates.recipient_email_missing);
      }
      return {
        toEmail: user.email,
        userId: user.id,
        organizationId: undefined as string | undefined,
      };
    }

    if (!dto.organizationId) {
      throw new BadRequestException(locals.templates.recipient_required);
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, name: true, email: true },
    });
    if (!organization) {
      throw new NotFoundException(locals.templates.recipient_not_found);
    }
    if (!organization.email) {
      throw new BadRequestException(
        locals.templates.organization_email_missing,
      );
    }
    return {
      toEmail: organization.email,
      userId: undefined as string | undefined,
      organizationId: organization.id,
    };
  }
}
