import { SetMetadata } from '@nestjs/common';
import type {
  AuthPermission,
  PermissionLevel,
  RequiredPermission,
} from '@/core/auth/auth-permissions.constants';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

export const RequirePermission = (
  permission: AuthPermission,
  level: PermissionLevel,
) =>
  SetMetadata<string, RequiredPermission>(REQUIRED_PERMISSIONS_KEY, {
    permission,
    level,
  });
