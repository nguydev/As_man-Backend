import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import { CreateAdminVaultDocumentDto } from '@/modules/vault/dto/vault.dto';
import { VaultService } from '@/modules/vault/services/vault.service';

@ApiTags('Admin Vault')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Vault permission required' })
@Controller({ path: 'admin/vault/documents', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminVaultController {
  constructor(private readonly vault: VaultService) {}

  @Post()
  @ApiOperation({ summary: 'Attach an uploaded file to a vault target' })
  @ApiNotFoundResponse({ description: 'File not found' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdminVaultDocumentDto,
  ) {
    return this.vault.createForAdmin(user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vault document metadata' })
  @ApiNotFoundResponse({ description: 'Vault document not found' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vault.removeForAdmin(user, id);
  }
}
