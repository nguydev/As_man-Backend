import { Injectable } from '@nestjs/common';
import { DevicePlatform } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

export interface SaveFcmTokenInput {
  userId: string;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
}

@Injectable()
export class FcmTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(input: SaveFcmTokenInput) {
    return this.prisma.fcmDeviceToken.upsert({
      where: { token: input.token },
      update: {
        userId: input.userId,
        platform: input.platform,
        deviceId: input.deviceId,
        isActive: true,
        invalidatedAt: null,
      },
      create: input,
    });
  }

  findActiveByUserId(userId: string) {
    return this.prisma.fcmDeviceToken.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByToken(token: string) {
    return this.prisma.fcmDeviceToken.findUnique({ where: { token } });
  }

  remove(token: string) {
    return this.prisma.fcmDeviceToken.deleteMany({ where: { token } });
  }

  invalidate(token: string) {
    return this.prisma.fcmDeviceToken.updateMany({
      where: { token },
      data: { isActive: false, invalidatedAt: new Date() },
    });
  }
}
