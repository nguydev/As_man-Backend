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
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import { AdminDashboardService } from '@/modules/dashboard/services/admin-dashboard.service';

@ApiTags('Admin Dashboard')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'SOS permission required' })
@Controller({ path: 'admin/dashboard', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('stats')
  @RequirePermission(AuthPermission.SYSTEM_SOS, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @ApiOkResponse({
    description:
      'Aggregate dashboard stats, active SOS alarms, and placeholder feed sections',
  })
  stats() {
    return this.dashboard.stats();
  }
}
