import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  ATTORNEY_IMPORT_JOB_SYNC,
  ATTORNEY_IMPORT_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import type { AttorneyImportJobData } from '@/infrastructure/queue/queue.types';
import { AttorneyImportService } from '@/modules/attorneys/services/attorney-import.service';
import type { AttorneyImportResult } from '@/modules/attorneys/types/attorney-import.types';

@Injectable()
@Processor(ATTORNEY_IMPORT_QUEUE)
export class AttorneyImportProcessor extends WorkerHost {
  private readonly logger = new Logger(AttorneyImportProcessor.name);

  constructor(private readonly imports: AttorneyImportService) {
    super();
  }

  async process(
    job: Job<AttorneyImportJobData>,
  ): Promise<AttorneyImportResult> {
    if (job.name !== ATTORNEY_IMPORT_JOB_SYNC) {
      this.logger.warn(`Ignoring unknown attorney import job ${job.name}`);
      return { created: 0, updated: 0, skipped: 0, failed: 0 };
    }

    this.logger.log(
      `Starting attorney import job=${job.id} trigger=${job.data.trigger}`,
    );
    return this.imports.sync();
  }
}
