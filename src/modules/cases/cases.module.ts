import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { AttorneysModule } from '@/modules/attorneys/attorneys.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { AdminCasesController } from '@/modules/cases/admin-cases.controller';
import { CasesController } from '@/modules/cases/cases.controller';
import { OrganizationCasesController } from '@/modules/cases/organization-cases.controller';
import { CaseRepository } from '@/modules/cases/repositories/case.repository';
import { CaseService } from '@/modules/cases/services/case.service';
@Module({
  imports: [
    AuthModule,
    AttorneysModule,
    NotificationsModule,
    MembershipsModule,
  ],
  controllers: [
    CasesController,
    AdminCasesController,
    OrganizationCasesController,
  ],
  providers: [CaseRepository, CaseService],
  exports: [CaseRepository],
})
export class CasesModule {}
