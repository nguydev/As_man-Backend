import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { LOCATION_HISTORY_QUEUE } from '@/infrastructure/queue/queue.constants';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { LocationGateway } from '@/modules/location/gateways/location.gateway';
import { LocationController } from '@/modules/location/location.controller';
import { MapLocationController } from '@/modules/location/map-location.controller';
import { LocationHistoryProcessor } from '@/modules/location/processors/location-history.processor';
import { LocationRepository } from '@/modules/location/repositories/location.repository';
import { MapLocationRepository } from '@/modules/location/repositories/map-location.repository';
import { DetentionService } from '@/modules/location/services/detention.service';
import { LocationFanoutService } from '@/modules/location/services/location-fanout.service';
import { LocationIngestionService } from '@/modules/location/services/location-ingestion.service';
import { LocationMembershipService } from '@/modules/location/services/location-membership.service';
import { LocationHistoryService } from '@/modules/location/services/location-history.service';
import { MapLocationService } from '@/modules/location/services/map-location.service';
import { MapVisibilityService } from '@/modules/location/services/map-visibility.service';
@Module({
  imports: [
    AuthModule,
    MembershipsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: LOCATION_HISTORY_QUEUE }),
  ],
  controllers: [LocationController, MapLocationController],
  providers: [
    LocationGateway,
    LocationHistoryProcessor,
    LocationRepository,
    MapLocationRepository,
    DetentionService,
    LocationFanoutService,
    LocationIngestionService,
    LocationMembershipService,
    LocationHistoryService,
    MapLocationService,
    MapVisibilityService,
  ],
  exports: [
    LocationRepository,
    LocationFanoutService,
    LocationMembershipService,
    MapVisibilityService,
  ],
})
export class LocationModule {}
