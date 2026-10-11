import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { LocationHistoryService } from '@/modules/location/services/location-history.service';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';
class LocationBackfillQuery {
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  since!: string;
}
@ApiTags('Location')
@ApiBearerAuth('access-token')
@Controller({ path: 'organizations/:organizationId/location', version: '1' })
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
export class LocationController {
  constructor(private readonly historyService: LocationHistoryService) {}

  @Get('drivers/:driverId/history')
  @ApiOperation({ summary: 'List a driver location history since a timestamp' })
  history(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) orgId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Query() query: LocationBackfillQuery,
  ) {
    return this.historyService.list(
      user.sub,
      orgId,
      driverId,
      new Date(query.since),
    );
  }
}
