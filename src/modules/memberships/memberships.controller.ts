import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { AddDriverMembershipDto } from '@/modules/memberships/dto/add-driver-membership.dto';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
import { MembershipService } from '@/modules/memberships/services/membership.service';

@ApiTags('Memberships')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'Organization management access required',
})
@Controller({ path: 'organizations/:organizationId/members', version: '1' })
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
@TokenType('access')
export class MembershipsController {
  constructor(private readonly memberships: MembershipService) {}

  @Post('drivers')
  @ApiOperation({ summary: 'Add an existing driver to an organization' })
  @ApiConflictResponse({ description: 'Subscription or driver limit conflict' })
  addDriver(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: AddDriverMembershipDto,
  ) {
    return this.memberships.addDriver(user.sub, organizationId, dto);
  }

  @Delete(':membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a driver membership' })
  removeDriver(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ) {
    return this.memberships.removeDriver(
      user.sub,
      organizationId,
      membershipId,
    );
  }
}
