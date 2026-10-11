import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Config } from '@/configs/environment.config';
import {
  ATTORNEY_IMPORT_QUEUE,
  HAZARD_QUEUE,
  LOCATION_HISTORY_QUEUE,
  MAIL_QUEUE,
  NOTIFICATION_QUEUE,
  SMS_QUEUE,
  SOS_QUEUE,
  STRIPE_QUEUE,
} from '@/infrastructure/queue/queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config>) => {
        const redis = configService.get<Config['redis']>('redis');
        if (!redis?.url) {
          throw new Error('Redis URL is required for BullMQ');
        }
        return {
          connection: {
            // ioredis accepts a URL via connection.url in BullMQ v5
            url: redis.url,
          },
          prefix: `${redis.keyPrefix}bull`,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 1_000,
            removeOnFail: 5_000,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: MAIL_QUEUE },
      { name: SMS_QUEUE },
      { name: STRIPE_QUEUE },
      { name: LOCATION_HISTORY_QUEUE },
      { name: SOS_QUEUE },
      { name: NOTIFICATION_QUEUE },
      { name: ATTORNEY_IMPORT_QUEUE },
      { name: HAZARD_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
