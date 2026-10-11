import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthProvider } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';
import { UserRepository } from '@/core/auth/repositories/user.repository';
import { EmailVerifyService } from '@/core/auth/services/email-verify.service';
import { TokenService } from '@/core/auth/services/token.service';
import type {
  DriverSignupDto,
  OrganizationSignupDto,
} from '@/core/auth/dto/signup.dto';
import type {
  AuthTokens,
  RequestContext,
} from '@/core/auth/types/auth-tokens.type';
import locals from '@/locals';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class RegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserRepository,
    private readonly emailVerify: EmailVerifyService,
    private readonly tokens: TokenService,
  ) {}

  async registerOrganization(
    dto: OrganizationSignupDto,
    context: RequestContext,
  ): Promise<AuthTokens> {
    await this.assertEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: { id: string };
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            profile: { create: { name: dto.name } },
            credentials: {
              create: {
                provider: AuthProvider.EMAIL,
                providerId: dto.email,
                passwordHash,
              },
            },
          },
          select: { id: true },
        });
        await tx.organization.create({
          data: {
            name: dto.organizationName,
            email: dto.email,
            createdById: created.id,
            members: {
              create: {
                userId: created.id,
                role: 'OWNER',
                createdById: created.id,
              },
            },
          },
        });
        return created;
      });
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }

    return this.completeRegistration(user.id, dto.email, context);
  }

  async registerDriver(
    dto: DriverSignupDto,
    context: RequestContext,
  ): Promise<AuthTokens> {
    await this.assertEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: { id: string };
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          profile: { create: { name: dto.name } },
          credentials: {
            create: {
              provider: AuthProvider.EMAIL,
              providerId: dto.email,
              passwordHash,
            },
          },
          driver: {
            create: {
              vinNumber: dto.vinNumber,
              licensePlate: dto.licensePlate,
            },
          },
        },
        select: { id: true },
      });
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }

    return this.completeRegistration(user.id, dto.email, context);
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    if (await this.users.findByEmail(email)) {
      throw new ConflictException(locals.auth.email_already_registered);
    }
  }

  private async completeRegistration(
    userId: string,
    email: string,
    context: RequestContext,
  ): Promise<AuthTokens> {
    try {
      await this.emailVerify.issueAndSend(userId, email);
    } catch {
      // Account creation succeeds when verification delivery is unavailable.
    }
    return this.tokens.issue(userId, context);
  }

  private handleUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(locals.auth.email_already_registered);
    }
  }
}
