import type { Role, UserStatus } from '@prisma-client';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';

export interface AuthorizationSnapshot {
  role: Role;
  status: UserStatus;
  isDeleted: boolean;
  permissions: PermissionMap;
}

export interface AuthenticatedUser extends JwtPayload {
  authorization: AuthorizationSnapshot;
}
