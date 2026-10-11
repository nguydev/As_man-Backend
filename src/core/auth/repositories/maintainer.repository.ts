import { Injectable } from '@nestjs/common';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class MaintainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPermissionsByUserId(userId: string): Promise<PermissionMap | null> {
    const maintainer = await this.prisma.maintainer.findFirst({
      where: {
        userId,
        user: { status: 'ACTIVE', isDeleted: false },
      },
      select: { permissions: true },
    });

    return (maintainer?.permissions as PermissionMap | undefined) ?? null;
  }
}
