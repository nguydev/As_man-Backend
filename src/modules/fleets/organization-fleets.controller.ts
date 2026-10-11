import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import {
  AssignFleetDriverDto,
  CreateFleetDto,
  UpdateFleetDto,
} from '@/modules/fleets/dto/fleet.dto';
import { FleetService } from '@/modules/fleets/services/fleet.service';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';

@ApiTags('Fleets')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'Organization management access required',
})
@Controller({ path: 'organizations/:organizationId/fleets', version: '1' })
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER', 'PROVIDER')
@TokenType('access')
export class OrganizationFleetsController {
  constructor(private readonly fleets: FleetService) {}

  @Get()
  @ApiOperation({ summary: 'List fleets in the organization' })
  list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.fleets.list(organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a fleet' })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateFleetDto,
  ) {
    return this.fleets.create(user.sub, organizationId, dto);
  }

  @Get(':fleetId')
  @ApiOperation({ summary: 'Get a fleet with members' })
  get(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
  ) {
    return this.fleets.get(organizationId, fleetId);
  }

  @Patch(':fleetId')
  @ApiOperation({ summary: 'Update a fleet (name and/or indicator color)' })
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Body() dto: UpdateFleetDto,
  ) {
    return this.fleets.update(organizationId, fleetId, dto);
  }

  @Delete(':fleetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a fleet' })
  remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
  ) {
    return this.fleets.remove(organizationId, fleetId);
  }

  @Post(':fleetId/drivers')
  @ApiOperation({ summary: 'Assign a driver to a fleet' })
  assignDriver(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Body() dto: AssignFleetDriverDto,
  ) {
    return this.fleets.assignDriver(user.sub, organizationId, fleetId, dto);
  }

  @Delete(':fleetId/drivers/:driverId')
  @ApiOperation({ summary: 'Remove a driver from a fleet' })
  removeDriver(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ) {
    return this.fleets.removeDriver(organizationId, fleetId, driverId);
  }
}
