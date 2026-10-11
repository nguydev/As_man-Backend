import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
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
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationStatusDto,
} from '@/modules/organizations/dto/create-organization.dto';
import { OrganizationService } from '@/modules/organizations/services/organization.service';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({ path: 'organizations', version: '1' })
@UseGuards(JwtAuthGuard)
@TokenType('access')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_ORGANIZATION, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Create an organization',
    description: 'Requires platform administration permission.',
  })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_ORGANIZATION, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Update an organization' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List accessible organizations' })
  @ApiPaginationQuery(['name', 'createdAt', 'updatedAt'])
  list(
    @CurrentUser() user: JwtPayload,
    @Query(PaginationPipe) pagination: Pagination,
  ) {
    return this.organizations.list(user.sub, pagination);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_ORGANIZATION, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get an organization by id' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.getById(id);
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_ORGANIZATION, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Update organization approval status' })
  @ApiForbiddenResponse({ description: 'Permission denied' })
  updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationStatusDto,
  ) {
    return this.organizations.updateStatus(id, user.sub, dto);
  }
}
