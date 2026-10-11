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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma-client';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { CacheTtl } from '@/common/core/decorators/cache.decorator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import {
  CreateAdminUserDto,
  ListUsersDto,
  SearchUsersDto,
  UpdateUserStatusDto,
} from '@/modules/user/dto/update-user.dto';
import { UserService } from '@/modules/user/user.service';

@ApiTags('Admin Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'User read permission required' })
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminUsersController {
  constructor(private readonly users: UserService) {}

  @Post()
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Create a user and send a password setup invite',
  })
  @ApiCreatedResponse({ description: 'User created' })
  @ApiConflictResponse({ description: 'Email already registered' })
  create(@Body() dto: CreateAdminUserDto) {
    return this.users.createForAdmin(dto);
  }

  @Get()
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.READ)
  @CacheTtl(5)
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ description: 'Paginated users' })
  @ApiPaginationQuery(['email', 'role', 'status', 'createdAt', 'updatedAt'])
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  list(
    @Query(PaginationPipe) pagination: Pagination,
    @Query() filters: ListUsersDto,
  ) {
    return this.users.listForAdmin(pagination, filters);
  }

  @Get('stats')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.READ)
  @CacheTtl(10)
  @ApiOperation({ summary: 'Get user status counts' })
  @ApiOkResponse({ description: 'User status counts' })
  stats() {
    return this.users.stats();
  }

  @Get('search')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.READ)
  @ApiOperation({ summary: 'Search users by name or email' })
  @ApiOkResponse({ description: 'Matching users' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'driversOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  search(@Query() query: SearchUsersDto) {
    return this.users.searchForAdmin(query);
  }

  @Get(':id')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.READ)
  @CacheTtl(5)
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiOkResponse({ description: 'User details' })
  @ApiNotFoundResponse({ description: 'User not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getForAdmin(id);
  }

  @Patch(':id/status')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.WRITE)
  @ApiOperation({
    summary: 'Ban, restrict, suspend, or reactivate a user',
  })
  @ApiOkResponse({ description: 'User status updated' })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(actor.sub, id, dto);
  }

  @Patch(':id/restore')
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.ALL)
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  @ApiOkResponse({ description: 'User restored' })
  @ApiNotFoundResponse({ description: 'User not found' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.restore(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(AuthPermission.SYSTEM_USER, PermissionLevel.ALL)
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiNoContentResponse({ description: 'User deleted' })
  @ApiNotFoundResponse({ description: 'User not found' })
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.remove(actor.sub, id);
  }
}
