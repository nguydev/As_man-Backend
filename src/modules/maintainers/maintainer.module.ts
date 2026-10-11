import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { MaintainerService } from './maintainer.service';
import { MaintainerController } from './maintainer.controller';
import { MaintainerRepository } from './repositories/maintainer.repository';

@Module({
  imports: [AuthModule],
  controllers: [MaintainerController],
  providers: [MaintainerService, MaintainerRepository],
})
export class MaintainerModule {}
