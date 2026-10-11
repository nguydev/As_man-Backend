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
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import {
  ProviderCreateDriverDto,
  UpdateDriverProfileDto,
} from '@/modules/drivers/dto/driver.dto';
import { CreateDriverService } from '@/modules/drivers/services/create-driver.service';
import { OrganizationRoles } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationRolesGuard } from '@/modules/memberships/guards/organization-roles.guard';

@ApiTags('Drivers')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({
  description: 'Organization management access required',
})
@Controller({ path: 'organizations/:organizationId/drivers', version: '1' })
@UseGuards(JwtAuthGuard, OrganizationRolesGuard)
@OrganizationRoles('OWNER')
@TokenType('access')
export class OrganizationDriversController {
  constructor(private readonly drivers: CreateDriverService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an organization driver',
    description:
      'Creates a driver account with an email/password credential and adds it to the organization.',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: ProviderCreateDriverDto,
  ) {
    return this.drivers.execute(user.sub, dto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List drivers in the organization' })
  list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.drivers.findByOrganizationId(organizationId);
  }

  @Get(':driverId')
  @ApiOperation({ summary: 'Get an organization driver' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  get(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ) {
    return this.drivers.findOrganizationDriver(organizationId, driverId);
  }

  @Patch(':driverId')
  @ApiOperation({ summary: 'Update an organization driver profile' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.drivers.updateOrganizationDriver(organizationId, driverId, dto);
  }

  @Delete(':driverId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate an organization driver membership' })
  @ApiNotFoundResponse({ description: 'Driver or membership not found' })
  terminate(
    @CurrentUser() user: JwtPayload,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ) {
    return this.drivers.terminateOrganizationDriver(
      user.sub,
      organizationId,
      driverId,
    );
  }
}
