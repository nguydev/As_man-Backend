import { SetMetadata } from '@nestjs/common';
import type { OrganizationMemberRole } from '@prisma-client';

export const ORGANIZATION_ROLES_KEY = 'organization_roles';

export const OrganizationRoles = (...roles: OrganizationMemberRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);
