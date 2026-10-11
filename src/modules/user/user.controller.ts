import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { UpdateOwnProfileDto } from '@/modules/user/dto/update-user.dto';
import { UserService } from '@/modules/user/user.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ description: 'Profile updated' })
  updateOwnProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateOwnProfileDto,
  ) {
    return this.users.updateOwnProfile(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Profile details' })
  getOwnProfile(@CurrentUser('sub') userId: string) {
    return this.users.getOwnProfile(userId);
  }
}
