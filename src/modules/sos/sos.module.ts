import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { SOS_QUEUE } from '@/infrastructure/queue/queue.constants';
import { AttorneysModule } from '@/modules/attorneys/attorneys.module';
import { LocationModule } from '@/modules/location/location.module';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AdminSosController } from '@/modules/sos/admin-sos.controller';
import { SosGateway } from '@/modules/sos/gateways/sos.gateway';
import { OrganizationSosController } from '@/modules/sos/organization-sos.controller';
import { SosProcessor } from '@/modules/sos/processors/sos.processor';
import { SosRepository } from '@/modules/sos/repositories/sos.repository';
import { SosController } from '@/modules/sos/sos.controller';
import { SosService } from '@/modules/sos/services/sos.service';
@Module({
  imports: [
    AuthModule,
    AttorneysModule,
    LocationModule,
    MembershipsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: SOS_QUEUE }),
  ],
  controllers: [SosController, AdminSosController, OrganizationSosController],
  providers: [SosRepository, SosService, SosProcessor, SosGateway],
})
export class SosModule {}
