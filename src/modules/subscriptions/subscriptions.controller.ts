import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { Public } from '@/core/auth/decorators/public.decorator';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
import {
  CreatePlanDto,
  UpdatePlanDto,
} from '@/modules/subscriptions/dto/plan.dto';
import { PlanService } from '@/modules/subscriptions/services/plan.service';
import { OrganizationSubscriptionService } from '@/modules/subscriptions/services/organization-subscription.service';
import { StripeWebhookService } from '@/modules/subscriptions/services/stripe-webhook.service';

@ApiTags('Subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(
    private readonly plans: PlanService,
    private readonly organizationSubscriptions: OrganizationSubscriptionService,
    private readonly webhooks: StripeWebhookService,
  ) {}
  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List subscription plans' })
  @ApiPaginationQuery(['name', 'driverLimit', 'createdAt', 'updatedAt'])
  listPlans(@Query(PaginationPipe) pagination: Pagination) {
    return this.plans.list(pagination);
  }
  @Post('plans')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.WRITE)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a subscription plan' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }
  @Patch('plans/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.WRITE)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revise a subscription plan' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(id, dto);
  }
  @Delete('plans/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_SUBSCRIPTION, PermissionLevel.ALL)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deprecate a subscription plan' })
  removePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.remove(id);
  }
  @Get('organizations/:organizationId')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List subscriptions for an organization' })
  @ApiPaginationQuery(['currentPeriodEnd', 'createdAt', 'updatedAt'])
  listSubscriptions(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query(PaginationPipe) pagination: Pagination,
  ) {
    return this.organizationSubscriptions.list(
      user.sub,
      organizationId,
      pagination,
    );
  }
  @Post('stripe/webhook')
  @Public()
  @ApiOperation({ summary: 'Receive a signed Stripe webhook event' })
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.webhooks.receive(req.rawBody, signature);
  }
}
