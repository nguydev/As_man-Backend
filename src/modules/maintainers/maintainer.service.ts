import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import { normalizePermissionMap } from '@/core/auth/helpers/permission.helper';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { AuthorizationService } from '@/core/auth/services/authorization.service';
import { PasswordInviteService } from '@/core/auth/services/password-invite.service';
import { TokenService } from '@/core/auth/services/token.service';
import type { CreateMaintainerDto } from '@/modules/maintainers/dto/create-maintainer.dto';
import type { UpdateMaintainerDto } from '@/modules/maintainers/dto/update-maintainer.dto';
import { MaintainerRepository } from '@/modules/maintainers/repositories/maintainer.repository';
import locals from '@/locals';

@Injectable()
export class MaintainerService {
  constructor(
    private readonly maintainers: MaintainerRepository,
    private readonly users: UserRepository,
    private readonly invites: PasswordInviteService,
    private readonly authorization: AuthorizationService,
    private readonly tokens: TokenService,
  ) {}

  async create(actorId: string, dto: CreateMaintainerDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException(locals.auth.email_already_registered);
    }

    const created = await this.maintainers.create({
      name: dto.name,
      email: dto.email,
      jobTitle: dto.jobTitle,
      permissions: normalizePermissionMap(dto.permissions),
      createdById: actorId,
    });
    await this.invites.issue(created.id, dto.email);
    return created.maintainer;
  }

  findAll(pagination: Pagination) {
    return this.maintainers.list(pagination);
  }

  async findOne(id: string) {
    const maintainer = await this.maintainers.findById(id);
    if (!maintainer) {
      throw new NotFoundException(locals.maintainers.not_found);
    }
    return maintainer;
  }

  async update(id: string, dto: UpdateMaintainerDto) {
    const current = await this.findOne(id);
    if (dto.jobTitle === undefined && dto.permissions === undefined) {
      throw new BadRequestException(locals.maintainers.update_field_required);
    }

    const updated = await this.maintainers.update(id, {
      jobTitle: dto.jobTitle,
      permissions: dto.permissions
        ? normalizePermissionMap(dto.permissions)
        : undefined,
    });
    await this.authorization.invalidate(current.user.id);
    return updated;
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOne(id);
    if (current.user.id === actorId) {
      throw new ForbiddenException(locals.maintainers.cannot_delete_self);
    }
    const userId = await this.maintainers.softDeleteUser(id);
    if (!userId) {
      throw new NotFoundException(locals.maintainers.not_found);
    }
    await this.tokens.revokeAllForUser(userId);
  }
}
