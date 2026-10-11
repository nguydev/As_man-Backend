import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { FilesModule } from '@/core/files/files.module';
import { CasesModule } from '@/modules/cases/cases.module';
import { MembershipsModule } from '@/modules/memberships/memberships.module';
import { AdminVaultController } from '@/modules/vault/admin-vault.controller';
import { VaultRepository } from '@/modules/vault/repositories/vault.repository';
import { VaultService } from '@/modules/vault/services/vault.service';
import { VaultController } from '@/modules/vault/vault.controller';
@Module({
  imports: [AuthModule, FilesModule, CasesModule, MembershipsModule],
  controllers: [VaultController, AdminVaultController],
  providers: [VaultRepository, VaultService],
})
export class VaultModule {}
