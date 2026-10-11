import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RequiredPermission } from '@/core/auth/auth-permissions.constants';
import { REQUIRED_PERMISSIONS_KEY } from '@/core/auth/decorators/require-permission.decorator';
import { hasPermission } from '@/core/auth/helpers/permission.helper';
import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';
import locals from '@/locals';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission =
      this.reflector.getAllAndOverride<RequiredPermission>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requiredPermission) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (user?.authorization.role === 'ADMIN') return true;

    const allowed = hasPermission(
      user?.authorization.permissions ?? null,
      requiredPermission.permission,
      requiredPermission.level,
    );

    if (!allowed) {
      throw new ForbiddenException(locals.auth.permission_denied);
    }

    return true;
  }
}
