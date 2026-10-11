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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  CreateCaseDto,
  ListCasesDto,
  UpdateCaseDto,
  UpdateCaseStatusDto,
} from '@/modules/cases/dto/case.dto';
import { CaseService } from '@/modules/cases/services/case.service';
@ApiTags('Cases')
@ApiBearerAuth('access-token')
@Controller({ path: 'cases', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private readonly cases: CaseService) {}
  @Post()
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Create a case assignment' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCaseDto) {
    return this.cases.create(user.sub, dto);
  }
  @Get()
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.READ)
  @ApiOperation({ summary: 'List cases' })
  @ApiPaginationQuery(['createdAt', 'updatedAt'])
  list(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListCasesDto,
  ) {
    return this.cases.list(pagination, filters);
  }
  @Get(':id')
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get a case with its status history' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.cases.get(id);
  }

  @Get(':id/tracker')
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get case tracker timeline and progress' })
  tracker(@Param('id', ParseUUIDPipe) id: string) {
    return this.cases.tracker(id);
  }

  @Patch(':id')
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Update case details' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCaseDto) {
    return this.cases.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission(AuthPermission.SYSTEM_CASE, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Transition a case to an allowed status' })
  change(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseStatusDto,
  ) {
    return this.cases.changeStatus(id, user.sub, dto);
  }
}
