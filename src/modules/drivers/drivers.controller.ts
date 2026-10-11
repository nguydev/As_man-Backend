import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { UpdateDriverProfileDto } from '@/modules/drivers/dto/driver.dto';
import { DriverProfileService } from '@/modules/drivers/services/driver-profile.service';

@ApiTags('Drivers')
@Controller({ path: 'drivers', version: '1' })
export class DriversController {
  constructor(private readonly profiles: DriverProfileService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @TokenType('access')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current driver profile' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.profiles.get(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @TokenType('access')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the current driver profile' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.profiles.update(user.sub, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @TokenType('access')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the current driver profile' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  removeProfile(@CurrentUser() user: JwtPayload) {
    return this.profiles.remove(user.sub);
  }
}
