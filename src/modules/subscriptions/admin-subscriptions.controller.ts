import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SubStatus } from '@prisma-client';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { CacheTtl } from '@/common/core/decorators/cache.decorator';
import { ListAdminSubscriptionsDto } from '@/modules/subscriptions/dto/admin-subscription.dto';
import { AdminSubscriptionService } from '@/modules/subscriptions/services/admin-subscription.service';

@ApiTags('Admin Subscriptions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Subscription permission required' })
@Controller({ path: 'admin/subscriptions', version: '1' })
export class AdminSubscriptionsController {
  constructor(private readonly service: AdminSubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'List all organization subscriptions' })
  @ApiOkResponse({ description: 'Paginated subscriptions' })
  @ApiPaginationQuery(['status', 'currentPeriodEnd', 'createdAt', 'updatedAt'])
  @ApiQuery({ name: 'status', required: false, enum: SubStatus })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiQuery({ name: 'planId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.READ)
  getSubscriptions(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListAdminSubscriptionsDto,
  ) {
    return this.service.list(pagination, filters);
  }

  @Get('stats')
  @CacheTtl(300)
  @ApiOperation({ summary: 'Get subscription revenue and churn stats' })
  @ApiOkResponse({ description: 'Subscription stats' })
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.READ)
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription details' })
  @ApiOkResponse({ description: 'Subscription details' })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.READ)
  getSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiOkResponse({ description: 'Subscription canceled' })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.ALL)
  cancelSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a subscription' })
  @ApiOkResponse({ description: 'Subscription reactivated' })
  @ApiNotFoundResponse({ description: 'Subscription not found' })
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.ALL)
  reactivateSubscription(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}
