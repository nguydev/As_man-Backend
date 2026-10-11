import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { MembershipsController } from '@/modules/memberships/memberships.controller';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
import { MembershipRepository } from '@/modules/memberships/repositories/membership.repository';
import { MembershipService } from '@/modules/memberships/services/membership.service';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';

@Module({
  imports: [AuthModule, forwardRef(() => NotificationsModule)],
  controllers: [MembershipsController],
  providers: [
    MembershipRepository,
    MembershipService,
    OrganizationAccessService,
    OrganizationRolesGuard,
  ],
  exports: [
    MembershipRepository,
    MembershipService,
    OrganizationAccessService,
    OrganizationRolesGuard,
  ],
})
export class MembershipsModule {}
