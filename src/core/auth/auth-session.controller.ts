import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/core/auth/decorators/current-user.decorator';
import { TokenType } from '@/core/auth/decorators/token-type.decorator';
import { TokenService } from '@/core/auth/services/token.service';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';

@ApiTags('Sessions')
@ApiBearerAuth('access-token')
@Controller({ path: 'auth/sessions', version: '1' })
@TokenType('access')
export class AuthSessionController {
  constructor(private readonly tokens: TokenService) {}

  @Get()
  @ApiOperation({ summary: 'List active login sessions' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.tokens.listSessions(user.sub, user.jti);
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Terminate an active login session' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    await this.tokens.terminateSession(user.sub, sessionId);
  }
}
