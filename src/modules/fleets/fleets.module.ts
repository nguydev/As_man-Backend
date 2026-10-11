import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { OrganizationFleetsController } from '@/modules/fleets/organization-fleets.controller';
import { FleetRepository } from '@/modules/fleets/repositories/fleet.repository';
import { FleetService } from '@/modules/fleets/services/fleet.service';
import { MembershipsModule } from '@/modules/memberships/memberships.module';

@Module({
  imports: [AuthModule, MembershipsModule],
  controllers: [OrganizationFleetsController],
  providers: [FleetRepository, FleetService],
  exports: [FleetRepository, FleetService],
})
export class FleetsModule {}
