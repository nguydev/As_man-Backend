import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { LegalController } from '@/modules/legal/legal.controller';
import { LegalRepository } from '@/modules/legal/repositories/legal.repository';
import { LegalService } from '@/modules/legal/legal.service';

@Module({
  imports: [AuthModule],
  controllers: [LegalController],
  providers: [LegalRepository, LegalService],
})
export class LegalModule {}
