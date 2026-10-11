import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import {
  AuthPermission,
  PermissionLevel,
  type AuthPermission as AuthPermissionValue,
} from '@/core/auth/auth-permissions.constants';
import { hasPermission } from '@/core/auth/helpers/permission.helper';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import { FileObjectRepository } from '@/core/files/repositories/file-object.repository';
import { CaseRepository } from '@/modules/cases/repositories/case.repository';
import { VaultRepository } from '@/modules/vault/repositories/vault.repository';
import {
  AdminVaultTargetType,
  type CreateAdminVaultDocumentDto,
  type CreateVaultDocumentDto,
} from '@/modules/vault/dto/vault.dto';
import locals from '@/locals';

@Injectable()
export class VaultService {
  constructor(
    private readonly vault: VaultRepository,
    private readonly files: FileObjectRepository,
    private readonly cases: CaseRepository,
  ) {}

  async create(userId: string, dto: CreateVaultDocumentDto) {
    const driver = await this.driver(userId);
    await this.assertUploadedFile(userId, dto.fileObjectId);
    return this.vault.createDriver(driver.id, {
      fileObjectId: dto.fileObjectId,
      name: dto.name,
      ...(await this.caseLink(dto)),
    });
  }

  async createOrganization(
    userId: string,
    organizationId: string,
    dto: CreateVaultDocumentDto,
  ) {
    await this.assertUploadedFile(userId, dto.fileObjectId);
    return this.vault.createOrganization(organizationId, {
      fileObjectId: dto.fileObjectId,
      name: dto.name,
      ...(await this.caseLink(dto)),
    });
  }

  async createForOrganizationDriver(
    userId: string,
    organizationId: string,
    driverId: string,
    dto: CreateVaultDocumentDto,
  ) {
    const driver = await this.vault.findOrganizationDriver(
      driverId,
      organizationId,
    );
    if (!driver) throw new NotFoundException(locals.drivers.driver_not_found);
    await this.assertUploadedFile(userId, dto.fileObjectId);
    return this.vault.createDriver(driver.id, {
      fileObjectId: dto.fileObjectId,
      name: dto.name,
      ...(await this.caseLink(dto)),
    });
  }

  async createForAdmin(
    user: AuthenticatedUser,
    dto: CreateAdminVaultDocumentDto,
  ) {
    this.assertAdminTargetPermission(
      user,
      dto.targetType,
      PermissionLevel.WRITE,
    );
    await this.assertUploadedFile(user.sub, dto.fileObjectId);

    switch (dto.targetType) {
      case AdminVaultTargetType.ORGANIZATION:
        if (!(await this.vault.findOrganization(dto.targetId))) {
          throw new NotFoundException(locals.organizations.not_found);
        }
        return this.vault.create({
          organizationId: dto.targetId,
          fileObjectId: dto.fileObjectId,
        });
      case AdminVaultTargetType.DRIVER:
        if (!(await this.vault.findDriver(dto.targetId))) {
          throw new NotFoundException(locals.drivers.driver_not_found);
        }
        return this.vault.create({
          driverId: dto.targetId,
          fileObjectId: dto.fileObjectId,
        });
      case AdminVaultTargetType.CASE:
        if (!(await this.cases.find(dto.targetId))) {
          throw new NotFoundException(locals.cases.not_found);
        }
        return this.vault.create({
          linkedCaseId: dto.targetId,
          fileObjectId: dto.fileObjectId,
        });
    }
  }

  async listOwn(userId: string, pagination: Pagination) {
    return this.vault.list((await this.driver(userId)).id, pagination);
  }

  async listDriver(
    organizationId: string,
    driverId: string,
    pagination: Pagination,
  ) {
    const driver = await this.vault.findOrganizationDriver(
      driverId,
      organizationId,
    );
    if (!driver) throw new NotFoundException(locals.drivers.driver_not_found);
    return this.vault.list(driver.id, pagination);
  }

  listOrganization(organizationId: string, pagination: Pagination) {
    return this.vault.listOrganization(organizationId, pagination);
  }

  async removeOwn(userId: string, id: string) {
    const driver = await this.driver(userId);
    const doc = await this.vault.find(id);
    if (!doc || doc.driverId !== driver.id)
      throw new NotFoundException(locals.vault.not_found);
    return this.vault.remove(id);
  }

  async removeOrganization(organizationId: string, id: string) {
    const doc = await this.vault.find(id);
    if (!doc || doc.organizationId !== organizationId)
      throw new NotFoundException(locals.vault.not_found);
    return this.vault.remove(id);
  }

  async removeOrganizationDriver(
    organizationId: string,
    driverId: string,
    id: string,
  ) {
    const doc = await this.vault.findOrganizationDriverDocument(
      id,
      organizationId,
      driverId,
    );
    if (!doc) throw new NotFoundException(locals.vault.not_found);
    return this.vault.remove(id);
  }

  async removeForAdmin(user: AuthenticatedUser, id: string) {
    const doc = await this.vault.find(id);
    if (!doc) {
      throw new NotFoundException(locals.vault.not_found);
    }
    this.assertAdminTargetPermission(
      user,
      this.targetTypeForDocument(doc),
      PermissionLevel.ALL,
    );
    return this.vault.remove(id);
  }

  async linkCase(id: string, caseId: string) {
    if (!(await this.cases.find(caseId)))
      throw new NotFoundException(locals.cases.not_found);
    if (!(await this.vault.find(id)))
      throw new NotFoundException(locals.vault.not_found);
    return this.vault.linkCase(id, caseId);
  }

  private async caseLink(
    dto: CreateVaultDocumentDto,
  ): Promise<{ linkedCaseId?: string }> {
    if (!dto.caseId) {
      return {};
    }
    if (!(await this.cases.find(dto.caseId))) {
      throw new NotFoundException(locals.cases.not_found);
    }
    return { linkedCaseId: dto.caseId };
  }

  private async driver(userId: string) {
    const driver = await this.vault.findDriverByUser(userId);
    if (!driver) throw new NotFoundException(locals.drivers.driver_not_found);
    return driver;
  }

  private async assertUploadedFile(userId: string, fileObjectId: string) {
    const file = await this.files.findByIdForOwner(fileObjectId, userId);
    if (!file) throw new NotFoundException(locals.files.file_not_found);
    if (file.status !== 'UPLOADED') {
      throw new BadRequestException(locals.files.file_not_uploaded);
    }
  }

  private assertAdminTargetPermission(
    user: AuthenticatedUser,
    targetType: AdminVaultTargetType,
    level: PermissionLevel,
  ) {
    if (user.authorization.role === 'ADMIN') {
      return;
    }

    if (
      !hasPermission(
        user.authorization.permissions,
        this.permissionForTargetType(targetType),
        level,
      )
    ) {
      throw new ForbiddenException(locals.auth.permission_denied);
    }
  }

  private permissionForTargetType(
    targetType: AdminVaultTargetType,
  ): AuthPermissionValue {
    switch (targetType) {
      case AdminVaultTargetType.ORGANIZATION:
        return AuthPermission.SYSTEM_ORGANIZATION;
      case AdminVaultTargetType.DRIVER:
        return AuthPermission.SYSTEM_DRIVER;
      case AdminVaultTargetType.CASE:
        return AuthPermission.SYSTEM_CASE;
    }
  }

  private targetTypeForDocument(doc: {
    driverId: string | null;
    organizationId: string | null;
    linkedCaseId: string | null;
  }) {
    if (doc.organizationId) return AdminVaultTargetType.ORGANIZATION;
    if (doc.driverId) return AdminVaultTargetType.DRIVER;
    return AdminVaultTargetType.CASE;
  }
}
