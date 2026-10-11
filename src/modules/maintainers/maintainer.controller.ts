import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiNoContentResponse,
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
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import { CreateMaintainerDto } from '@/modules/maintainers/dto/create-maintainer.dto';
import { UpdateMaintainerDto } from '@/modules/maintainers/dto/update-maintainer.dto';
import { MaintainerService } from '@/modules/maintainers/maintainer.service';

@ApiTags('Maintainers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'User management permission required' })
@Controller({ path: 'maintainers', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintainerController {
  constructor(private readonly maintainers: MaintainerService) {}

  @Post()
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Create and invite a maintainer' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMaintainerDto,
  ) {
    return this.maintainers.create(actor.sub, dto);
  }

  @Get()
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.READ)
  @ApiOperation({ summary: 'List maintainers' })
  @ApiOkResponse({ description: 'Paginated maintainers' })
  @ApiPaginationQuery(['jobTitle', 'createdAt', 'updatedAt'])
  findAll(@Query(PaginationPipe) pagination: Pagination) {
    return this.maintainers.findAll(pagination);
  }

  @Get(':id')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.READ)
  @ApiOperation({ summary: 'Get a maintainer by ID' })
  @ApiNotFoundResponse({ description: 'Maintainer not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintainers.findOne(id);
  }

  @Patch(':id')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.WRITE)
  @ApiOperation({ summary: 'Update a maintainer' })
  @ApiNotFoundResponse({ description: 'Maintainer not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintainerDto,
  ) {
    return this.maintainers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.ALL)
  @ApiOperation({ summary: 'Delete a maintainer account' })
  @ApiNoContentResponse({ description: 'Maintainer deleted' })
  @ApiNotFoundResponse({ description: 'Maintainer not found' })
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.maintainers.remove(actor.sub, id);
  }
}
