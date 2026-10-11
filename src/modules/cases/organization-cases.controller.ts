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
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { ListCasesDto } from '@/modules/cases/dto/case.dto';
import { CaseService } from '@/modules/cases/services/case.service';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';

@ApiTags('Cases')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'Organization management access required',
})
@Controller({ path: 'organizations/:organizationId/cases', version: '1' })
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
@TokenType('access')
export class OrganizationCasesController {
  constructor(private readonly cases: CaseService) {}

  @Get()
  @ApiOperation({
    summary: 'List cases for drivers in the organization',
  })
  @ApiPaginationQuery(['createdAt', 'updatedAt'])
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListCasesDto,
  ) {
    return this.cases.listForOrganization(organizationId, pagination, filters);
  }
}
