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
  CreateOrganizationNotificationDto as CreateAdminNotificationDto,
  ListNotificationsQueryDto,
} from '@/modules/notifications/dto/notification.dto';
import { NotificationService } from '@/modules/notifications/services/notification.service';

@ApiTags('Admin Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/notifications', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.READ)
  @ApiOperation({ summary: 'List current admin system notifications' })
  @ApiPaginationQuery(['createdAt', 'updatedAt'])
  list(
    @CurrentUser() user: JwtPayload,
    @Query(PaginationPipe) pagination: Pagination,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.listForSystem(
      user.sub,
      pagination,
      query.unreadOnly,
    );
  }

  @Post()
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Create a system notification for admins' })
  create(@Body() dto: CreateAdminNotificationDto) {
    return this.notifications.createForSystem(dto);
  }

  @Patch(':id/read')
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.READ)
  @ApiOperation({ summary: 'Mark an admin system notification as read' })
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markReadForSystem(id, user.sub);
  }

  @Patch(':id/unread')
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.READ)
  @ApiOperation({ summary: 'Mark an admin system notification as unread' })
  markUnread(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markUnreadForSystem(id, user.sub);
  }

  @Delete()
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.READ)
  @ApiOperation({ summary: 'Delete all current admin system notifications' })
  deleteAll(@CurrentUser() user: JwtPayload) {
    return this.notifications.deleteAllForSystem(user.sub);
  }

  @Delete(':id')
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.READ)
  @ApiOperation({ summary: 'Delete an admin system notification' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.deleteForSystem(id, user.sub);
  }
}
