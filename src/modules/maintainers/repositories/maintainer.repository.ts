import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';
import { PrismaService } from '@/database/prisma.service';

const MAINTAINER_SELECT = {
  id: true,
  jobTitle: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      status: true,
      isEmailVerified: true,
      profile: { select: { name: true, avatarUrl: true } },
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      profile: { select: { name: true } },
    },
  },
} satisfies Prisma.MaintainerSelect;

export interface CreateMaintainerInput {
  name: string;
  email: string;
  jobTitle: string;
  permissions: PermissionMap;
  createdById: string;
}

export interface UpdateMaintainerInput {
  jobTitle?: string;
  permissions?: PermissionMap;
}

@Injectable()
export class MaintainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateMaintainerInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        profile: { create: { name: input.name } },
        credentials: {
          create: {
            provider: 'EMAIL',
            providerId: input.email,
            passwordHash: null,
          },
        },
        maintainer: {
          create: {
            jobTitle: input.jobTitle,
            permissions: input.permissions,
            createdById: input.createdById,
          },
        },
      },
      select: {
        id: true,
        maintainer: { select: MAINTAINER_SELECT },
      },
    });
  }

  list(pagination: Pagination) {
    return prismaPaginate(
      this.prisma.maintainer,
      {
        where: { user: { isDeleted: false } },
        select: MAINTAINER_SELECT,
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['jobTitle', 'createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
      },
    );
  }

  findById(id: string) {
    return this.prisma.maintainer.findFirst({
      where: { id, user: { isDeleted: false } },
      select: MAINTAINER_SELECT,
    });
  }

  update(id: string, input: UpdateMaintainerInput) {
    return this.prisma.maintainer.update({
      where: { id },
      data: {
        jobTitle: input.jobTitle,
        permissions: input.permissions,
      },
      select: MAINTAINER_SELECT,
    });
  }

  async softDeleteUser(id: string) {
    const maintainer = await this.prisma.maintainer.findFirst({
      where: { id, user: { isDeleted: false } },
      select: { userId: true },
    });
    if (!maintainer) return null;
    await this.prisma.user.update({
      where: { id: maintainer.userId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return maintainer.userId;
  }
}
