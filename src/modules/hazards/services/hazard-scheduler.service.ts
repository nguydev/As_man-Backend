import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  HAZARD_JOB_EXPIRE,
  HAZARD_QUEUE,
} from '@/infrastructure/queue/queue.constants';
import type { HazardExpireJobData } from '@/infrastructure/queue/queue.types';

const SCHEDULER_ID = 'hazard-expire-5m';

@Injectable()
export class HazardSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(HazardSchedulerService.name);

  constructor(
    @InjectQueue(HAZARD_QUEUE)
    private readonly queue: Queue<HazardExpireJobData>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: 5 * 60_000 },
      {
        name: HAZARD_JOB_EXPIRE,
        data: { trigger: 'scheduled' },
      },
    );
    this.logger.log('Hazard expire scheduler registered every=5m');
  }
}
