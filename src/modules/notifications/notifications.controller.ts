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
  CreateNotificationDto,
  ListNotificationsQueryDto,
} from '@/modules/notifications/dto/notification.dto';
import { NotificationService } from '@/modules/notifications/services/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_NOTIFICATION, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Create a user or system notification' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notifications.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List current user notifications' })
  @ApiPaginationQuery(['createdAt', 'updatedAt'])
  list(
    @CurrentUser() user: JwtPayload,
    @Query(PaginationPipe) pagination: Pagination,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.list(user.sub, pagination, query.unreadOnly);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(id, user.sub);
  }

  @Patch(':id/unread')
  @ApiOperation({ summary: 'Mark a notification as unread' })
  markUnread(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markUnread(id, user.sub);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all current user notifications' })
  deleteAll(@CurrentUser() user: JwtPayload) {
    return this.notifications.deleteAll(user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.delete(id, user.sub);
  }
}
