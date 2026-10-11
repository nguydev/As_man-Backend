import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '@/common/pagination/pagination.decorator';
import { PaginationPipe } from '@/common/pagination/pagination.pipe';
import type { Pagination } from '@/common/pagination/pagination.types';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import {
  CreateEmergencyContactDto,
  TriggerSosDto,
  UpdateEmergencyContactDto,
} from '@/modules/sos/dto/sos.dto';
import { SosService } from '@/modules/sos/services/sos.service';
@ApiTags('SOS')
@ApiBearerAuth('access-token')
@Controller({ path: 'sos', version: '1' })
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(private readonly sos: SosService) {}
  @Post('trigger')
  @ApiOperation({ summary: 'Persist and broadcast an SOS incident' })
  trigger(@CurrentUser() user: JwtPayload, @Body() dto: TriggerSosDto) {
    return this.sos.trigger(user.sub, dto);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Create an emergency contact' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEmergencyContactDto,
  ) {
    return this.sos.createContact(user.sub, dto);
  }
  @Get('contacts')
  @ApiOperation({ summary: 'List the current driver emergency contacts' })
  @ApiPaginationQuery(['priority', 'name', 'createdAt', 'updatedAt'])
  list(
    @CurrentUser() user: JwtPayload,
    @Query(PaginationPipe) pagination: Pagination,
  ) {
    return this.sos.contacts(user.sub, pagination);
  }
  @Patch('contacts/:id')
  @ApiOperation({ summary: 'Update an emergency contact' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyContactDto,
  ) {
    return this.sos.updateContact(user.sub, id, dto);
  }
  @Delete('contacts/:id')
  @ApiOperation({ summary: 'Delete an emergency contact' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sos.removeContact(user.sub, id);
  }
}
