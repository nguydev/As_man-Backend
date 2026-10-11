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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
import {
  CreateOrganizationNotificationDto,
  ListNotificationsQueryDto,
} from '@/modules/notifications/dto/notification.dto';
import { NotificationService } from '@/modules/notifications/services/notification.service';

@ApiTags('Organization Notifications')
@ApiBearerAuth('access-token')
@Controller({
  path: 'organizations/:organizationId/notifications',
  version: '1',
})
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
export class OrganizationNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List current user organization notifications' })
  @ApiPaginationQuery(['createdAt', 'updatedAt'])
  list(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query(PaginationPipe) pagination: Pagination,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.listForOrganization(
      user.sub,
      organizationId,
      pagination,
      query.unreadOnly,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create an organization notification' })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateOrganizationNotificationDto,
  ) {
    return this.notifications.createForOrganization(organizationId, dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark an organization notification as read' })
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markReadForOrganization(
      id,
      user.sub,
      organizationId,
    );
  }

  @Patch(':id/unread')
  @ApiOperation({ summary: 'Mark an organization notification as unread' })
  markUnread(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markUnreadForOrganization(
      id,
      user.sub,
      organizationId,
    );
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all current user organization notifications',
  })
  deleteAll(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.notifications.deleteAllForOrganization(
      user.sub,
      organizationId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an organization notification' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.deleteForOrganization(
      id,
      user.sub,
      organizationId,
    );
  }
}
