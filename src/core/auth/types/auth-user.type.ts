import type { Role } from '@prisma-client';
import type { PermissionMap } from '@/core/auth/auth-permissions.constants';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  isEmailVerified: boolean;
  isOnboarded: boolean;
  name: string | null;
  avatar: string | null;
  role: Role;
  maintainer: { permissions: PermissionMap } | null;
}
