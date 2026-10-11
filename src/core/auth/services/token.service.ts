import { randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma-client';
import { CryptoService } from '@/common/crypto/crypto.service';
import type { Config } from '@/configs/environment.config';
import { SessionRepository } from '@/core/auth/repositories/session.repository';
import { AuthCacheService } from '@/core/auth/services/auth-cache.service';
import { AuthorizationService } from '@/core/auth/services/authorization.service';
import type {
  AuthTokens,
  RequestContext,
} from '@/core/auth/types/auth-tokens.type';
import type { AuthorizationSnapshot } from '@/core/auth/types/authorization.type';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import locals from '@/locals';

const SECONDS_IN_DAY = 86_400;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Config>,
    private readonly crypto: CryptoService,
    private readonly cache: AuthCacheService,
    private readonly authorization: AuthorizationService,
    private readonly sessions: SessionRepository,
  ) {}

  async issue(
    userId: string,
    context: RequestContext = {},
  ): Promise<AuthTokens> {
    const auth = this.config.get<Config['auth']>('auth')!;
    const authorization = await this.authorization.get(userId);
    if (
      !authorization ||
      authorization.status !== UserStatus.ACTIVE ||
      authorization.isDeleted
    ) {
      throw new UnauthorizedException(locals.auth.account_no_longer_available);
    }

    const jti = randomUUID();
    const refreshToken = randomUUID();
    const refreshTokenHash = this.crypto.hashSha256(refreshToken);
    const accessTtlSeconds = this.parseDurationSeconds(auth.jwtAccessExpiresIn);
    const refreshTtlSeconds = this.parseDurationSeconds(
      auth.jwtRefreshExpiresIn,
    );
    const now = Date.now();
    const accessExpiresAt = new Date(now + accessTtlSeconds * 1000);
    const refreshExpiresAt = new Date(now + refreshTtlSeconds * 1000);
    const accessToken = await this.signAccessToken(userId, jti, authorization);

    await this.sessions.create({
      userId,
      accessTokenId: jti,
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      ipAddress: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });
    await Promise.all([
      this.cache.setSessionMirror(
        refreshTokenHash,
        { userId, jti },
        refreshTtlSeconds,
      ),
      this.cache.addUserSession(userId, jti, refreshTtlSeconds),
    ]);

    return {
      access: { token: accessToken, expiresAt: accessExpiresAt },
      refresh: { token: refreshToken, expiresAt: refreshExpiresAt },
    };
  }

  async refresh(
    presentedRefreshToken: string,
    context: RequestContext = {},
  ): Promise<AuthTokens> {
    const presentedHash = this.crypto.hashSha256(presentedRefreshToken);
    const mirror = await this.cache.takeSessionMirror(presentedHash);

    if (!mirror) {
      const reusedSession = await this.sessions.findByHash(presentedHash);
      if (reusedSession) {
        await this.revokeAllForUser(reusedSession.userId);
      }
      throw new UnauthorizedException(locals.auth.refresh_token_required);
    }

    const session = await this.sessions.findActiveByHash(presentedHash);
    if (!session || session.userId !== mirror.userId) {
      await this.revokeAllForUser(mirror.userId);
      throw new UnauthorizedException(locals.auth.refresh_token_required);
    }

    await this.sessions.revokeByHash(presentedHash);
    return this.issue(session.userId, context);
  }

  async revoke(payload: JwtPayload, refreshToken?: string): Promise<void> {
    await this.blacklist(payload.jti, payload.exp);

    const session = await this.sessions.findByAccessTokenId(payload.jti);
    if (session?.userId === payload.sub) {
      await this.sessions.revokeByHash(session.refreshTokenHash);
      await this.cache.deleteSessionMirror(session.refreshTokenHash);
    }

    if (refreshToken) {
      const hash = this.crypto.hashSha256(refreshToken);
      const presentedSession = await this.sessions.findByHash(hash);
      if (presentedSession?.userId === payload.sub) {
        await this.sessions.revokeByHash(hash);
        await this.cache.deleteSessionMirror(hash);
      }
    }

    await this.cache.removeUserSession(payload.sub, payload.jti);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const auth = this.config.get<Config['auth']>('auth')!;
    const accessTtlSeconds = this.parseDurationSeconds(auth.jwtAccessExpiresIn);
    const [sessions, tokenIds] = await Promise.all([
      this.sessions.listActiveForUser(userId),
      this.cache.getUserSessions(userId),
    ]);

    await this.sessions.revokeAllForUser(userId);
    await this.authorization.invalidate(userId);
    await Promise.all([
      ...sessions.map((session) =>
        this.cache.deleteSessionMirror(session.refreshTokenHash),
      ),
      ...tokenIds.map((jti) =>
        this.cache.blacklistAccessToken(jti, accessTtlSeconds),
      ),
      this.cache.deleteUserSessions(userId),
    ]);
  }

  async listSessions(userId: string, currentTokenId: string) {
    const sessions = await this.sessions.listActiveForUser(userId);
    const mirrors = await Promise.all(
      sessions.map((session) =>
        this.cache.getSessionMirror(session.refreshTokenHash),
      ),
    );

    return sessions.flatMap((session, index) => {
      const mirror = mirrors[index];
      if (mirror?.userId !== userId || mirror.jti !== session.accessTokenId) {
        return [];
      }

      return {
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent: session.accessTokenId === currentTokenId,
      };
    });
  }

  async terminateSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findActiveByIdForUser(
      sessionId,
      userId,
    );
    if (!session) {
      throw new NotFoundException(locals.auth.session_not_found);
    }

    await this.sessions.revokeById(session.id, userId);
    await this.cache.deleteSessionMirror(session.refreshTokenHash);
    await this.cache.removeUserSession(userId, session.accessTokenId);

    const accessTtlSeconds = this.parseDurationSeconds(
      this.config.get<Config['auth']>('auth')!.jwtAccessExpiresIn,
    );
    const accessExpiresAt =
      Math.floor(session.createdAt.getTime() / 1000) + accessTtlSeconds;
    const remainingAccessTtlSeconds =
      accessExpiresAt - Math.floor(Date.now() / 1000);
    if (remainingAccessTtlSeconds > 0) {
      await this.cache.blacklistAccessToken(
        session.accessTokenId,
        remainingAccessTtlSeconds,
      );
    }
  }

  signAccessToken(
    userId: string,
    jti: string,
    authorization: AuthorizationSnapshot,
  ): Promise<string> {
    const auth = this.config.get<Config['auth']>('auth')!;
    const payload: JwtPayload = {
      sub: userId,
      role: authorization.role,
      jti,
      tokenType: 'access',
    };
    return this.jwt.signAsync(payload, {
      secret: auth.jwtAccessSecret,
      expiresIn: this.parseDurationSeconds(auth.jwtAccessExpiresIn),
    });
  }

  private async blacklist(jti: string, exp?: number): Promise<void> {
    const ttlSeconds = exp ? exp - Math.floor(Date.now() / 1000) : 0;
    if (ttlSeconds > 0) {
      await this.cache.blacklistAccessToken(jti, ttlSeconds);
    }
  }

  private parseDurationSeconds(input: string): number {
    const match = input.trim().match(/^(\d+)\s*([smhd])?$/i);
    if (!match) return SECONDS_IN_DAY;
    const value = Number(match[1]);
    const unit = (match[2] ?? 's').toLowerCase();
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * SECONDS_IN_DAY;
      default:
        return value;
    }
  }
}
