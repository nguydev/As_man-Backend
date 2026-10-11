export const AuthPermission = {
  // SYSTEM PERMISSIONS
  SYSTEM_USER: 'system.user',
  SYSTEM_ORGANIZATION: 'system.organization',
  SYSTEM_DRIVER: 'system.driver',
  SYSTEM_ATTORNEY: 'system.attorney',
  SYSTEM_CASE: 'system.case',
  SYSTEM_NOTIFICATION: 'system.notification',
  SYSTEM_SUBSCRIPTION: 'system.subscription',
  SYSTEM_VAULT: 'system.vault',
  SYSTEM_SOS: 'system.sos',
  SYSTEM_LEGAL: 'system.legal',
  SYSTEM_TEMPLATE: 'system.template',
} as const;

export type AuthPermission =
  (typeof AuthPermission)[keyof typeof AuthPermission];

export const PermissionLevel = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ALL: 3,
} as const;

export type PermissionLevel =
  (typeof PermissionLevel)[keyof typeof PermissionLevel];

export type PermissionMap = Partial<Record<AuthPermission, PermissionLevel>>;

export interface RequiredPermission {
  permission: AuthPermission;
  level: PermissionLevel;
}
