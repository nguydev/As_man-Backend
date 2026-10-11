import { Module } from '@nestjs/common';
import { FcmTokenController } from '@/core/fcm-token/fcm-token.controller';
import { FcmTokenRepository } from '@/core/fcm-token/repositories/fcm-token.repository';
import { FcmTokenService } from '@/core/fcm-token/fcm-token.service';

@Module({
  controllers: [FcmTokenController],
  providers: [FcmTokenRepository, FcmTokenService],
  exports: [FcmTokenRepository, FcmTokenService],
})
export class FcmTokenModule {}
