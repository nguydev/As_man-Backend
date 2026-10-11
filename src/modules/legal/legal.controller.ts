import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LegalType } from '@prisma-client';
import {
  AuthPermission,
  PermissionLevel,
} from '@/core/auth/auth-permissions.constants';
import { RequirePermission } from '@/core/auth/decorators/require-permission.decorator';
import { JwtAuthGuard } from '@/core/auth/guards/jwt.guard';
import { PermissionsGuard } from '@/core/auth/guards/permissions.guard';
import {
  CreateLegalDto,
  LegalFaqItemDto,
} from '@/modules/legal/dto/create-legal.dto';
import { LegalService } from '@/modules/legal/legal.service';

@ApiTags('Legal')
@ApiExtraModels(LegalFaqItemDto)
@Controller({ path: 'legal', version: '1' })
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AuthPermission.SYSTEM_LEGAL, PermissionLevel.WRITE)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create or replace legal content by type' })
  @ApiCreatedResponse({ description: 'Legal content saved' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Legal permission required' })
  create(@Body() createLegalDto: CreateLegalDto) {
    return this.legalService.upsert(createLegalDto);
  }

  @Get()
  @ApiOperation({ summary: 'List legal content' })
  @ApiOkResponse({ description: 'Legal content list' })
  findAll() {
    return this.legalService.findAll();
  }

  @Get(':type')
  @ApiOperation({ summary: 'Get legal content by type' })
  @ApiOkResponse({ description: 'Legal content details' })
  @ApiNotFoundResponse({ description: 'Legal content not found' })
  findOne(@Param('type', new ParseEnumPipe(LegalType)) type: LegalType) {
    return this.legalService.findOne(type);
  }
}
