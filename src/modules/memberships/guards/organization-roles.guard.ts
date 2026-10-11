import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationMemberRole } from '@prisma-client';
import type { Request } from 'express';
import type { JwtPayload } from '@/core/auth/types/jwt-payload.type';
import { ORGANIZATION_ROLES_KEY } from '@/modules/memberships/decorators/organization-roles.decorator';
import { OrganizationAccessService } from '@/modules/memberships/services/organization-access.service';

@Injectable()
export class OrganizationRolesGuard implements CanActivate {
  private readonly uuidPipe = new ParseUUIDPipe({ version: '4' });

  constructor(
    private readonly reflector: Reflector,
    private readonly access: OrganizationAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<OrganizationMemberRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user: JwtPayload; params: { organizationId: string } }
      >();
    const organizationId = await this.uuidPipe.transform(
      request.params.organizationId,
      { type: 'param', data: 'organizationId' },
    );

    await this.access.assertRoles(request.user.sub, organizationId, roles);
    return true;
  }
}
