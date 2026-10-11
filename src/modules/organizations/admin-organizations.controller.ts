import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { CacheTtl } from '@/common/core/decorators/cache.decorator';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import { OrganizationService } from '@/modules/organizations/services/organization.service';

@ApiTags('Admin Organizations')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Organization read permission required' })
@Controller({ path: 'admin/organizations', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminOrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get('stats')
  @RequirePermission(AuthPermission.SYSTEM_ORGANIZATION, PermissionLevel.READ)
  @CacheTtl(30)
  @ApiOperation({ summary: 'Get organization counts' })
  @ApiOkResponse({ description: 'Organization counts' })
  stats() {
    return this.organizations.stats();
  }
}
