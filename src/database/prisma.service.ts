import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Config } from '@/configs/environment.config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Config>) {
    const database = config.getOrThrow<Config['database']>('database');
    const adapter = new PrismaPg({
      connectionString: database.url,
      max: database.poolSize,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
