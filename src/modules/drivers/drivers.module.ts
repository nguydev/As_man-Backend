import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { AdminDriversController } from '@/modules/drivers/admin-drivers.controller';
import { DriversController } from '@/modules/drivers/drivers.controller';
import { OrganizationDriversController } from '@/modules/drivers/organization-drivers.controller';
import { DriverRepository } from '@/modules/drivers/repositories/driver.repository';
import { AdminDriverService } from '@/modules/drivers/services/admin-driver.service';
import { CreateDriverService } from '@/modules/drivers/services/create-driver.service';
import { DriverProfileService } from '@/modules/drivers/services/driver-profile.service';
import { MembershipsModule } from '@/modules/memberships/memberships.module';

@Module({
  imports: [AuthModule, MembershipsModule],
  controllers: [
    AdminDriversController,
    DriversController,
    OrganizationDriversController,
  ],
  providers: [
    DriverRepository,
    AdminDriverService,
    CreateDriverService,
    DriverProfileService,
  ],
  exports: [DriverRepository],
})
export class DriversModule {}
