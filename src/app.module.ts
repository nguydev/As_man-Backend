import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration, { Config } from '@/configs/environment.config';
import { ObservabilityModule } from '@/infrastructure/observability/observability.module';
import { PrismaModule } from '@/database/prisma.module';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { CryptoModule } from '@/common/crypto/crypto.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { MailerModule } from '@/infrastructure/mailer/mailer.module';
import { SmsModule } from '@/infrastructure/sms/sms.module';
import { FirebaseModule } from '@/infrastructure/firebase/firebase.module';
import { StorageModule } from '@/infrastructure/storage/storage.module';
import { FcmTokenModule } from '@/core/fcm-token/fcm-token.module';
import { HealthModule } from '@/core/health/health.module';
import { AuthModule } from '@/core/auth/auth.module';
import { FilesModule } from '@/core/files/files.module';
import { OrganizationsModule } from '@/modules/organizations/organizations.module';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { DriversModule } from '@/modules/drivers/drivers.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { AttorneysModule } from '@/modules/attorneys/attorneys.module';
import { CasesModule } from '@/modules/cases/cases.module';
import { VaultModule } from '@/modules/vault/vault.module';
import { LocationModule } from '@/modules/location/location.module';
import { HazardsModule } from '@/modules/hazards/hazards.module';
import { SosModule } from '@/modules/sos/sos.module';
import { UserModule } from '@/modules/user/user.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { MaintainerModule } from '@/modules/maintainers/maintainer.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';
import { LegalModule } from '@/modules/legal/legal.module';
import { TemplatesModule } from '@/modules/templates/templates.module';
import { FleetsModule } from '@/modules/fleets/fleets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ObservabilityModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Config, true>) => {
        const config = configService.get('app', { infer: true });
        return [
          {
            ttl: config.rateLimitTtl,
            limit: config.rateLimitLimit,
          },
        ];
      },
    }),
    CommonModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    QueueModule,
    MailerModule,
    SmsModule,
    FirebaseModule,
    StorageModule,
    AuthModule,
    FcmTokenModule,
    FilesModule,
    OrganizationsModule,
    MembershipsModule,
    DriversModule,
    FleetsModule,
    SubscriptionsModule,
    AttorneysModule,
    CasesModule,
    VaultModule,
    LocationModule,
    HazardsModule,
    SosModule,
    HealthModule,
    UserModule,
    NotificationsModule,
    MaintainerModule,
    DashboardModule,
    LegalModule,
    TemplatesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
