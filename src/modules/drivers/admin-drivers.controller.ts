import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import {
  AdminCreateDriverDto,
  ListDriversDto,
} from '@/modules/drivers/dto/driver.dto';
import { AdminDriverService } from '@/modules/drivers/services/admin-driver.service';
import { CreateDriverService } from '@/modules/drivers/services/create-driver.service';

@ApiTags('Drivers')
@Controller({ path: 'drivers', version: '1' })
export class AdminDriversController {
  constructor(
    private readonly createDriver: CreateDriverService,
    private readonly adminDrivers: AdminDriverService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @TokenType('access')
  @RequirePermission(AuthPermission.SYSTEM_DRIVER, PermissionLevel.READ)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List drivers' })
  @ApiPaginationQuery([
    'createdAt',
    'updatedAt',
    'licensePlate',
    'vinNumber',
  ])
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  list(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListDriversDto,
  ) {
    return this.adminDrivers.list(pagination, { search: filters.search });
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @TokenType('access')
  @RequirePermission(AuthPermission.SYSTEM_DRIVER, PermissionLevel.WRITE)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a managed driver',
    description:
      'Requires platform administration permission. Creates a driver account with an email/password credential.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: AdminCreateDriverDto) {
    return this.createDriver.execute(user.sub, dto, dto.organizationId, {
      skipOrganizationAccessCheck: true,
    });
  }
}
