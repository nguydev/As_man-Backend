import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { OrganizationDashboardService } from '@/modules/dashboard/services/organization-dashboard.service';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';

@ApiTags('Organization Dashboard')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'Organization management access required',
})
@Controller({ path: 'organizations/:organizationId/dashboard', version: '1' })
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
@TokenType('access')
export class OrganizationDashboardController {
  constructor(private readonly dashboard: OrganizationDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get organization dashboard stats' })
  @ApiOkResponse({
    description:
      'Org-scoped stats, 7-day driver activity, and recent SOS alerts',
  })
  get(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.dashboard.get(organizationId);
  }
}
