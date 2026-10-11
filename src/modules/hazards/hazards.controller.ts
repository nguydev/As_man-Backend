import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import {
  ListHazardsQueryDto,
  ReportHazardDto,
} from '@/modules/hazards/dto/hazard.dto';
import { HazardService } from '@/modules/hazards/services/hazard.service';

@ApiTags('Hazards')
@ApiBearerAuth('access-token')
@Controller({ path: 'hazards', version: '1' })
@UseGuards(JwtAuthGuard)
export class HazardsController {
  constructor(private readonly hazards: HazardService) {}

  @Get()
  @ApiOperation({
    summary: 'List open Police/ICE reports in the map viewport',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListHazardsQueryDto,
  ) {
    return this.hazards.list(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Report Police/ICE at the current GPS, or confirm a nearby pin',
  })
  report(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReportHazardDto) {
    return this.hazards.report(user, dto);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm that Police/ICE is still at this pin' })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hazards.confirm(user, id);
  }

  @Post(':id/clear')
  @ApiOperation({ summary: 'Vote that there is no Police/ICE at this pin' })
  clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hazards.clear(user, id);
  }
}
