import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
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
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import {
  CreateIncidentCaseDto,
  ListSosIncidentsDto,
} from '@/modules/sos/dto/sos.dto';
import { SosService } from '@/modules/sos/services/sos.service';

@ApiTags('Admin SOS')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'SOS permission required' })
@Controller({ path: 'admin/sos/incidents', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminSosController {
  constructor(private readonly sos: SosService) {}

  @Get()
  @RequirePermission(AuthPermission.SYSTEM_SOS, PermissionLevel.READ)
  @ApiOperation({ summary: 'List SOS and critical incidents' })
  @ApiOkResponse({ description: 'Paginated incidents' })
  @ApiPaginationQuery(['createdAt', 'updatedAt', 'status', 'type'])
  list(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListSosIncidentsDto,
  ) {
    return this.sos.adminIncidents(pagination, filters);
  }

  @Get(':id')
  @RequirePermission(AuthPermission.SYSTEM_SOS, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get a single SOS or detention incident' })
  @ApiOkResponse({ description: 'Incident details' })
  @ApiNotFoundResponse({ description: 'Incident not found' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sos.adminIncident(id);
  }

  @Patch(':id/acknowledge')
  @RequirePermission(AuthPermission.SYSTEM_SOS, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Acknowledge an SOS or critical incident' })
  @ApiOkResponse({ description: 'Incident acknowledged' })
  @ApiNotFoundResponse({ description: 'Incident not found' })
  acknowledge(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sos.adminAcknowledgeIncident(user.sub, id);
  }

  @Patch(':id/resolve')
  @RequirePermission(AuthPermission.SYSTEM_SOS, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Resolve an SOS or critical incident' })
  @ApiOkResponse({ description: 'Incident resolved' })
  @ApiNotFoundResponse({ description: 'Incident not found' })
  resolve(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sos.adminResolveIncident(user.sub, id);
  }

  @Post(':id/case')
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Create and link a case from an incident' })
  @ApiOkResponse({ description: 'Incident linked to a case' })
  @ApiNotFoundResponse({ description: 'Incident or attorney not found' })
  createCase(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIncidentCaseDto,
  ) {
    return this.sos.adminCreateCaseFromIncident(user.sub, id, dto);
  }
}
