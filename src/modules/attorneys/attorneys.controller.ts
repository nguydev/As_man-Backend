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
  ApiOperation,
  ApiQuery,
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
import {
  CreateAttorneyDto,
  ListAttorneysDto,
  UpdateAttorneyDto,
} from '@/modules/attorneys/dto/attorney.dto';
import { AttorneyImportSchedulerService } from '@/modules/attorneys/services/attorney-import-scheduler.service';
import { AttorneyService } from '@/modules/attorneys/services/attorney.service';
@ApiTags('Attorneys')
@ApiBearerAuth('access-token')
@Controller({ path: 'attorneys', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttorneysController {
  constructor(
    private readonly attorneys: AttorneyService,
    private readonly attorneyImports: AttorneyImportSchedulerService,
  ) {}

  @Post()
  @RequirePermission(AuthPermission.SYSTEM_ATTORNEY, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Create an admin-managed attorney record',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAttorneyDto) {
    return this.attorneys.create(user.sub, dto);
  }

  @Post('import')
  @RequirePermission(AuthPermission.SYSTEM_ATTORNEY, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Enqueue a manual finalized-attorney import from the remote API',
  })
  importNow() {
    return this.attorneyImports.enqueueManual();
  }

  @Get()
  @RequirePermission(AuthPermission.SYSTEM_ATTORNEY, PermissionLevel.READ)
  @ApiOperation({ summary: 'List attorney records' })
  @ApiPaginationQuery([
    'name',
    'yearsOfExperience',
    'remoteWinRate',
    'remoteTotalCases',
    'lastCaseDate',
    'createdAt',
    'updatedAt',
  ])
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'language', required: false, type: String })
  list(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListAttorneysDto,
  ) {
    return this.attorneys.list(pagination, {
      search: filters.search,
      language: filters.language,
    });
  }

  @Get(':id')
  @RequirePermission(AuthPermission.SYSTEM_ATTORNEY, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get an attorney record' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.attorneys.get(id);
  }
  @Patch(':id')
  @RequirePermission(AuthPermission.SYSTEM_ATTORNEY, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Update an attorney record' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttorneyDto,
  ) {
    return this.attorneys.update(id, dto);
  }
  @Delete(':id')
  @RequirePermission(AuthPermission.SYSTEM_ATTORNEY, PermissionLevel.ALL)
  @ApiOperation({ summary: 'Delete an unused attorney record' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attorneys.remove(id);
  }
}
