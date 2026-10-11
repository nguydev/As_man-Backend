import type { Role } from '@prisma-client';

export type JwtTokenType = 'access';

export type JwtPayload = {
  sub: string;
  role: Role;
  jti: string;
  tokenType: 'access';
  iat?: number;
  exp?: number;
};
