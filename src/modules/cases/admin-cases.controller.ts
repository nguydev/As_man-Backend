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
import { CaseService } from '@/modules/cases/services/case.service';

@ApiTags('Admin Cases')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Case read permission required' })
@Controller({ path: 'admin/cases', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminCasesController {
  constructor(private readonly cases: CaseService) {}

  @Get('stats')
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.READ)
  @CacheTtl(30)
  @ApiOperation({ summary: 'Get case status counts' })
  @ApiOkResponse({ description: 'Case status counts' })
  stats() {
    return this.cases.stats();
  }
}
