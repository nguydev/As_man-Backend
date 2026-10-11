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
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
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
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
import {
  CreateVaultDocumentDto,
  LinkVaultCaseDto,
} from '@/modules/vault/dto/vault.dto';
import { VaultService } from '@/modules/vault/services/vault.service';
@ApiTags('Vault')
@ApiBearerAuth('access-token')
@Controller({ path: 'vault', version: '1' })
@UseGuards(JwtAuthGuard)
export class VaultController {
  constructor(private readonly vault: VaultService) {}
  @Post()
  @ApiOperation({ summary: 'Attach an uploaded file to the driver vault' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVaultDocumentDto) {
    return this.vault.create(user.sub, dto);
  }
  @Get()
  @ApiOperation({ summary: 'List the current driver vault documents' })
  @ApiPaginationQuery(['uploadedAt', 'updatedAt'])
  list(
    @CurrentUser() user: JwtPayload,
    @Query(PaginationPipe) pagination: Pagination,
  ) {
    return this.vault.listOwn(user.sub, pagination);
  }
  @Post('organizations/:organizationId/documents')
  @UseGuards(OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiOperation({ summary: 'Attach an uploaded file to an organization vault' })
  createOrganization(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateVaultDocumentDto,
  ) {
    return this.vault.createOrganization(user.sub, organizationId, dto);
  }
  @Get('organizations/:organizationId/documents')
  @UseGuards(OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiOperation({ summary: 'List organization vault documents' })
  @ApiPaginationQuery(['uploadedAt', 'updatedAt'])
  listOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query(PaginationPipe) pagination: Pagination,
  ) {
    return this.vault.listOrganization(organizationId, pagination);
  }
  @Post('organizations/:organizationId/drivers/:driverId')
  @UseGuards(OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiOperation({ summary: 'Attach an uploaded file to a driver vault' })
  @ApiNotFoundResponse({ description: 'Driver or file not found' })
  createDriver(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Body() dto: CreateVaultDocumentDto,
  ) {
    return this.vault.createForOrganizationDriver(
      user.sub,
      organizationId,
      driverId,
      dto,
    );
  }
  @Get('organizations/:organizationId/drivers/:driverId')
  @UseGuards(OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiOperation({
    summary: "List a driver's vault documents",
    description:
      'Available to platform admins, delegated admins with vault read access, and active organization owners or providers assigned to the driver.',
  })
  @ApiForbiddenResponse({ description: 'Vault access denied' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  @ApiPaginationQuery(['uploadedAt', 'updatedAt'])
  listDriver(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query(PaginationPipe) pagination: Pagination,
  ) {
    return this.vault.listDriver(organizationId, driverId, pagination);
  }
  @Delete('organizations/:organizationId/drivers/:driverId/documents/:id')
  @UseGuards(OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiOperation({ summary: 'Delete driver vault document metadata' })
  @ApiNotFoundResponse({ description: 'Vault document not found' })
  removeDriver(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vault.removeOrganizationDriver(organizationId, driverId, id);
  }
  @Delete('organizations/:organizationId/documents/:id')
  @UseGuards(OrganizationRolesGuard)
  @OrganizationRoles('OWNER', 'PROVIDER')
  @ApiOperation({ summary: 'Delete organization vault document metadata' })
  @ApiNotFoundResponse({ description: 'Vault document not found' })
  removeOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vault.removeOrganization(organizationId, id);
  }
  @Delete(':id')
  @ApiOperation({ summary: 'Delete owned vault document metadata' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vault.removeOwn(user.sub, id);
  }
  @Patch(':id/case')
  @UseGuards(PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_VAULT, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Link a vault document to a case' })
  link(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkVaultCaseDto) {
    return this.vault.linkCase(id, dto.caseId);
  }
}
