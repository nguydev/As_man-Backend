import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { HAZARD_QUEUE } from '@/infrastructure/queue/queue.constants';
import type { HazardExpireJobData } from '@/infrastructure/queue/queue.types';
import { HazardService } from '@/modules/hazards/services/hazard.service';

@Injectable()
@Processor(HAZARD_QUEUE)
export class HazardProcessor extends WorkerHost {
  private readonly logger = new Logger(HazardProcessor.name);

  constructor(private readonly hazards: HazardService) {
    super();
  }

  async process(job: Job<HazardExpireJobData>) {
    const result = await this.hazards.expireOpen();
    this.logger.log({
      event: 'hazard.expire',
      trigger: job.data.trigger,
      expired: result.expired,
    });
    return result;
  }
}
