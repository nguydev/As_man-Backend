import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { ATTORNEY_IMPORT_QUEUE } from '@/infrastructure/queue/queue.constants';
import { AttorneysController } from '@/modules/attorneys/attorneys.controller';
import { AttorneyImportProcessor } from '@/modules/attorneys/processors/attorney-import.processor';
import { AttorneyRepository } from '@/modules/attorneys/repositories/attorney.repository';
import { AttorneyImportClientService } from '@/modules/attorneys/services/attorney-import-client.service';
import { AttorneyImportSchedulerService } from '@/modules/attorneys/services/attorney-import-scheduler.service';
import { AttorneyImportService } from '@/modules/attorneys/services/attorney-import.service';
import { AttorneyService } from '@/modules/attorneys/services/attorney.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: ATTORNEY_IMPORT_QUEUE }),
  ],
  controllers: [AttorneysController],
  providers: [
    AttorneyRepository,
    AttorneyService,
    AttorneyImportClientService,
    AttorneyImportService,
    AttorneyImportSchedulerService,
    AttorneyImportProcessor,
  ],
  exports: [AttorneyRepository],
})
export class AttorneysModule {}
