import { Injectable } from '@nestjs/common';
import type {
  AuthProvider,
  Prisma,
  Role,
  User,
  UserStatus,
} from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';
import type { AuthUser } from '@/core/auth/types/auth-user.type';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';

export interface CreateUserInput {
  email?: string | null;
  phone?: string | null;
  role?: Role;
  status?: UserStatus;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  phone?: string;
}

export type AuthorizationUser = Prisma.UserGetPayload<{
  select: {
    role: true;
    status: true;
    isDeleted: true;
    maintainer: { select: { permissions: true } };
  };
}>;

export interface UserListFilters {
  role?: Role;
  status?: UserStatus;
  search?: string;
}

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  role: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  isOnboarded: true,
  createdAt: true,
  updatedAt: true,
  driver: {
    select: {
      id: true,
      vinNumber: true,
      licensePlate: true,
    },
  },
  profile: {
    select: { name: true, avatarUrl: true, address: true },
  },
} satisfies Prisma.UserSelect;

const ADMIN_USER_LIST_SELECT = {
  id: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  reason: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  deletedAt: true,
  profile: {
    select: { name: true, avatarUrl: true, address: true },
  },
} satisfies Prisma.UserSelect;

const ADMIN_USER_DETAIL_SELECT = {
  ...ADMIN_USER_LIST_SELECT,
  driver: {
    select: {
      id: true,
      vinNumber: true,
      licensePlate: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      vaultDocs: { select: { id: true, name: true, uploadedAt: true } },
      cases: { select: { id: true, status: true, createdAt: true } },
    },
  },
  organizationMembers: {
    select: {
      role: true,
      organization: {
        select: { id: true, name: true, region: true, status: true },
      },
    },
  },
  createdOrganizations: {
    select: { id: true, name: true, region: true, status: true },
  },
  createdCases: {
    select: { id: true, status: true, court: true, createdAt: true },
  },
} satisfies Prisma.UserSelect;

const ADMIN_USER_SEARCH_SELECT = {
  id: true,
  email: true,
  profile: {
    select: { name: true, avatarUrl: true },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
    });
  }

  listForAdmin(pagination: Pagination, filters: UserListFilters) {
    const where: Prisma.UserWhereInput = {
      role: filters.role,
      status: filters.status,
      ...(filters.search && {
        OR: [
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
          {
            profile: {
              name: { contains: filters.search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };
    return prismaPaginate(
      this.prisma.user,
      { where, select: ADMIN_USER_LIST_SELECT },
      pagination,
      {
        sortFields: ['email', 'role', 'status', 'createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
      },
    );
  }

  async stats() {
    const [total, pending, suspended] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.user.count({
        where: { isDeleted: false, isEmailVerified: false },
      }),
      this.prisma.user.count({
        where: { isDeleted: false, status: 'SUSPENDED' },
      }),
    ]);

    return { total, pending, suspended };
  }

  searchForAdmin(
    query: string,
    limit = 20,
    options?: { driversOnly?: boolean },
  ) {
    return this.prisma.user.findMany({
      where: {
        isDeleted: false,
        ...(options?.driversOnly ? { driver: { isNot: null } } : {}),
        ...(query
          ? {
              OR: [
                { email: { contains: query, mode: 'insensitive' } },
                { profile: { name: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        ...ADMIN_USER_SEARCH_SELECT,
        driver: {
          select: {
            id: true,
            licensePlate: true,
            vinNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findAdminDetails(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: ADMIN_USER_DETAIL_SELECT,
    });
  }

  findOwnProfile(id: string) {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      select: PUBLIC_USER_SELECT,
    });
  }

  updateProfile(
    id: string,
    input: {
      name?: string | null;
      avatarUrl?: string | null;
      phone?: string | null;
      address?: Prisma.AddressCreateWithoutProfileInput;
    },
  ) {
    const { address, phone, ...profile } = input;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(phone !== undefined && { phone }),
        profile: {
          upsert: {
            create: {
              ...profile,
              address: address ? { create: address } : undefined,
            },
            update: {
              ...profile,
              address: address
                ? { upsert: { create: address, update: address } }
                : undefined,
            },
          },
        },
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  updateStatus(id: string, status: UserStatus, reason: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: { status, reason },
      select: ADMIN_USER_DETAIL_SELECT,
    });
  }

  softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  restore(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
      select: ADMIN_USER_DETAIL_SELECT,
    });
  }

  findAuthorizationById(id: string): Promise<AuthorizationUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        status: true,
        isDeleted: true,
        maintainer: { select: { permissions: true } },
      },
    });
  }

  async findAuthUser(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        email: true,
        phone: true,
        isOnboarded: true,
        isEmailVerified: true,
        role: true,
        profile: { select: { name: true, avatarUrl: true } },
        maintainer: { select: { permissions: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.profile?.name ?? null,
      avatar: row.profile?.avatarUrl ?? null,
      email: row.email,
      phone: row.phone,
      isEmailVerified: row.isEmailVerified,
      isOnboarded: row.isOnboarded,
      role: row.role,
      maintainer: row.maintainer
        ? { permissions: row.maintainer.permissions as PermissionMap }
        : null,
    };
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { phone, isDeleted: false },
    });
  }

  findByProviderIdentity(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        isDeleted: false,
        credentials: { some: { provider, providerId } },
      },
    });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data: input });
  }

  createForAdmin(input: CreateAdminUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        profile: { create: { name: input.name } },
        credentials: {
          create: {
            provider: 'EMAIL',
            providerId: input.email,
            passwordHash: null,
          },
        },
      },
      select: ADMIN_USER_DETAIL_SELECT,
    });
  }

  markEmailVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isEmailVerified: true },
    });
  }

  markPhoneVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isPhoneVerified: true },
    });
  }

  updateEmail(id: string, email: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { email, isEmailVerified: false },
    });
  }

  updatePhone(id: string, phone: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { phone, isPhoneVerified: false },
    });
  }
}
