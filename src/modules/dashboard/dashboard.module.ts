import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { AdminDashboardController } from '@/modules/dashboard/admin-dashboard.controller';
import { OrganizationDashboardController } from '@/modules/dashboard/organization-dashboard.controller';
import { AdminDashboardService } from '@/modules/dashboard/services/admin-dashboard.service';
import { OrganizationDashboardService } from '@/modules/dashboard/services/organization-dashboard.service';
import { MembershipsModule } from '@/modules/memberships/memberships.module';

@Module({
  imports: [AuthModule, MembershipsModule],
  controllers: [AdminDashboardController, OrganizationDashboardController],
  providers: [AdminDashboardService, OrganizationDashboardService],
})
export class DashboardModule {}
