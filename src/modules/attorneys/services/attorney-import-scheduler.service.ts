import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Config } from '@/configs/environment.config';
import {
  ATTORNEY_IMPORT_JOB_SYNC,
  ATTORNEY_IMPORT_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import type { AttorneyImportJobData } from '@/infrastructure/queue/queue.types';
import locals from '@/locals';

const SCHEDULER_ID = 'attorney-import-daily';

@Injectable()
export class AttorneyImportSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AttorneyImportSchedulerService.name);

  constructor(
    @InjectQueue(ATTORNEY_IMPORT_QUEUE)
    private readonly queue: Queue<AttorneyImportJobData>,
    private readonly config: ConfigService<Config>,
  ) {}

  async onModuleInit(): Promise<void> {
    const settings = this.config.get('attorneyImport', { infer: true });
    if (!settings?.enabled) {
      await this.queue.removeJobScheduler(SCHEDULER_ID).catch(() => undefined);
      this.logger.log('Attorney import scheduler disabled');
      return;
    }

    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: settings.cron },
      {
        name: ATTORNEY_IMPORT_JOB_SYNC,
        data: { trigger: 'scheduled' },
      },
    );
    this.logger.log(
      `Attorney import scheduler registered cron=${settings.cron}`,
    );
  }

  async enqueueManual(): Promise<{ jobId: string }> {
    const settings = this.config.get('attorneyImport', { infer: true });
    if (!settings?.enabled) {
      throw new ServiceUnavailableException(locals.attorneys.import_disabled);
    }

    const job = await this.queue.add(
      ATTORNEY_IMPORT_JOB_SYNC,
      { trigger: 'manual' },
      {
        jobId: `attorney-import-manual-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return { jobId: String(job.id) };
  }
}
