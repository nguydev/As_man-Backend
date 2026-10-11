import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AdminOrganizationsController } from '@/modules/organizations/admin-organizations.controller';
import { OrganizationsController } from '@/modules/organizations/organizations.controller';
import { OrganizationRepository } from '@/modules/organizations/repositories/organization.repository';
import { OrganizationService } from '@/modules/organizations/services/organization.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OrganizationsController, AdminOrganizationsController],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationRepository],
})
export class OrganizationsModule {}
