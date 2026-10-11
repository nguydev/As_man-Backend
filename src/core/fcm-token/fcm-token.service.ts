import { Injectable } from '@nestjs/common';
import { DevicePlatform as PrismaDevicePlatform } from '@prisma-client';
import {
  DevicePlatform,
  RegisterFcmTokenDto,
} from '@/core/fcm-token/dto/register-fcm-token.dto';
import { RemoveFcmTokenDto } from '@/core/fcm-token/dto/remove-fcm-token.dto';
import { FcmTokenRepository } from '@/core/fcm-token/repositories/fcm-token.repository';
import locals from '@/locals';

@Injectable()
export class FcmTokenService {
  constructor(private readonly tokens: FcmTokenRepository) {}

  async registerToken(
    payload: RegisterFcmTokenDto,
    userId: string,
  ): Promise<{
    message: string;
    data: Awaited<ReturnType<FcmTokenRepository['save']>>;
  }> {
    const record = await this.tokens.save({
      userId,
      token: payload.token,
      platform: this.toPrismaPlatform(payload.platform),
      deviceId: payload.deviceId,
    });

    return {
      message: locals.fcm.token_registered,
      data: record,
    };
  }

  async removeToken(payload: RemoveFcmTokenDto): Promise<{
    message: string;
    data: { removed: boolean };
  }> {
    const existing = await this.tokens.findByToken(payload.token);

    if (!existing) {
      return {
        message: locals.fcm.token_not_found,
        data: { removed: false },
      };
    }

    await this.tokens.remove(payload.token);

    return {
      message: locals.fcm.token_removed,
      data: { removed: true },
    };
  }

  private toPrismaPlatform(platform: DevicePlatform): PrismaDevicePlatform {
    return {
      [DevicePlatform.IOS]: PrismaDevicePlatform.IOS,
      [DevicePlatform.ANDROID]: PrismaDevicePlatform.ANDROID,
      [DevicePlatform.WEB]: PrismaDevicePlatform.WEB,
    }[platform];
  }
}
