import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Config } from '@/configs/environment.config';
import { ACCESS_TOKEN_COOKIE } from '@/core/auth/auth.constants';
import { AuthCacheService } from '@/core/auth/services/auth-cache.service';
import { AuthorizationService } from '@/core/auth/services/authorization.service';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import locals from '@/locals';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<Config>,
    private readonly cache: AuthCacheService,
    private readonly authorization: AuthorizationService,
  ) {
    const auth = configService.get<Config['auth']>('auth')!;
    super({
      // One door, two keys: mobile sends a bearer header, web sends the cookie.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) =>
          (req?.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: auth.jwtAccessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (
      payload.tokenType !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new UnauthorizedException(locals.auth.access_token_required);
    }

    const [blacklisted, authorization] = await Promise.all([
      this.cache.isAccessTokenBlacklisted(payload.jti),
      this.authorization.get(payload.sub),
    ]);
    if (
      blacklisted ||
      !authorization ||
      authorization.status !== 'ACTIVE' ||
      authorization.isDeleted ||
      authorization.role !== payload.role
    ) {
      throw new UnauthorizedException(locals.auth.access_token_required);
    }

    return { ...payload, authorization };
  }
}
