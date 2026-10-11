import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import { MapLocationsQueryDto } from '@/modules/location/dto/map-locations.dto';
import { MapOverviewResponseDto } from '@/modules/location/dto/map-overview.dto';
import { MapLocationService } from '@/modules/location/services/map-location.service';

@ApiTags('Map')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({ path: 'map', version: '1' })
@UseGuards(JwtAuthGuard)
export class MapLocationController {
  constructor(private readonly locations: MapLocationService) {}

  @Get('locations')
  @ApiOperation({
    summary: 'List visible map markers in the viewport',
  })
  @ApiOkResponse({
    description:
      'Markers for SOS alerts, Police/ICE hazards, drivers (live Redis preferred, else latest LocationHistory), attorneys, and organizations. Returns clusters when zoom < 10.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MapLocationsQueryDto,
  ) {
    return this.locations.list(user, query);
  }

  @Get('overview')
  @ApiOperation({
    summary:
      'Fit-bounds for all locations visible to the caller (no viewport filter)',
  })
  @ApiOkResponse({
    description:
      'Center, padded bounds, suggested zoom, and role counts so the client can frame the fleet before loading /map/locations.',
    type: MapOverviewResponseDto,
  })
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.locations.overview(user, organizationId);
  }
}
