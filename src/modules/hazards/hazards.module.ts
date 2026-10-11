import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { HAZARD_QUEUE } from '@/infrastructure/queue/queue.constants';
import { HazardsController } from '@/modules/hazards/hazards.controller';
import { HazardProcessor } from '@/modules/hazards/processors/hazard.processor';
import { HazardRepository } from '@/modules/hazards/repositories/hazard.repository';
import { HazardSchedulerService } from '@/modules/hazards/services/hazard-scheduler.service';
import { HazardService } from '@/modules/hazards/services/hazard.service';
import { LocationModule } from '@/modules/location/location.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    LocationModule,
    NotificationsModule,
    BullModule.registerQueue({ name: HAZARD_QUEUE }),
  ],
  controllers: [HazardsController],
  providers: [
    HazardRepository,
    HazardService,
    HazardProcessor,
    HazardSchedulerService,
  ],
})
export class HazardsModule {}
