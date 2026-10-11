import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  EmailDispatchRecipientType,
  EmailDispatchStatus,
} from '@prisma-client';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import {
  CreateTemplateDto,
  ListEmailDispatchesDto,
  ListTemplatesDto,
  SendTemplateEmailDto,
  UpdateTemplateDto,
} from '@/modules/templates/dto/template.dto';
import { TemplateSendService } from '@/modules/templates/services/template-send.service';
import { TemplateService } from '@/modules/templates/services/template.service';

@ApiTags('Templates')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Template permission required' })
@Controller({ path: 'templates', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplatesController {
  constructor(
    private readonly templates: TemplateService,
    private readonly sends: TemplateSendService,
  ) {}

  @Post()
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Create a markdown content template',
    description:
      'Admin/maintainer-managed reusable markdown templates (emails, notices, copy blocks).',
  })
  @ApiConflictResponse({ description: 'Title already exists' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTemplateDto) {
    return this.templates.create(user.sub, dto);
  }

  @Post('send')
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Send a template email to a person or organization contact email',
  })
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendTemplateEmailDto) {
    return this.sends.send(user.sub, dto);
  }

  @Get()
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.READ)
  @ApiOperation({ summary: 'List markdown content templates' })
  @ApiPaginationQuery(['title', 'createdAt', 'updatedAt'])
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOkResponse({ description: 'Paginated template list' })
  list(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListTemplatesDto,
  ) {
    return this.templates.list(pagination, { search: filters.search });
  }

  @Get('sends')
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.READ)
  @ApiOperation({ summary: 'List template email send history' })
  @ApiPaginationQuery(['createdAt', 'updatedAt', 'sentAt', 'subject', 'status'])
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: EmailDispatchStatus })
  @ApiQuery({
    name: 'recipientType',
    required: false,
    enum: EmailDispatchRecipientType,
  })
  listSends(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListEmailDispatchesDto,
  ) {
    return this.sends.list(pagination, filters);
  }

  @Get('sends/:id')
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get a template email send record' })
  @ApiNotFoundResponse({ description: 'Send record not found' })
  getSend(@Param('id', ParseUUIDPipe) id: string) {
    return this.sends.get(id);
  }

  @Get(':id')
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get a template by id' })
  @ApiOkResponse({ description: 'Template details' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(id);
  }

  @Patch(':id')
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Update a markdown content template' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiConflictResponse({ description: 'Title already exists' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(AuthPermission.SYSTEM_TEMPLATE, PermissionLevel.ALL)
  @ApiOperation({ summary: 'Delete a template' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(id);
  }
}
