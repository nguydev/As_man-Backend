import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
import { ListSosIncidentsDto } from '@/modules/sos/dto/sos.dto';
import { SosService } from '@/modules/sos/services/sos.service';

@ApiTags('Organization SOS')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'Organization management access required',
})
@Controller({
  path: 'organizations/:organizationId/sos/incidents',
  version: '1',
})
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
@TokenType('access')
export class OrganizationSosController {
  constructor(private readonly sos: SosService) {}

  @Get()
  @ApiOperation({ summary: 'List latest organization SOS incidents' })
  @ApiOkResponse({ description: 'Paginated organization incidents' })
  @ApiPaginationQuery(['createdAt', 'updatedAt', 'status', 'type'])
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListSosIncidentsDto,
  ) {
    return this.sos.organizationIncidents(organizationId, pagination, filters);
  }
}
