import type {
  AuthPermission,
  PermissionMap,
} from '@/core/auth/auth-permissions.constants';
import { PermissionLevel } from '@/core/auth/auth-permissions.constants';

export const hasPermission = (
  permissions: PermissionMap | null,
  key: AuthPermission,
  requiredLevel: PermissionLevel,
): boolean => (permissions?.[key] ?? PermissionLevel.NONE) >= requiredLevel;

export const normalizePermissionMap = (value: unknown): PermissionMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([, level]) =>
        typeof level === 'number' &&
        Number.isInteger(level) &&
        level >= PermissionLevel.NONE &&
        level <= PermissionLevel.ALL,
    ),
  );
};
