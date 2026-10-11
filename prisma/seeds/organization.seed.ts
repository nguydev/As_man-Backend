import * as bcrypt from 'bcryptjs';
import type { PrismaClient } from '../generated/prisma/client';

export async function seedOrganization(prisma: PrismaClient): Promise<void> {
  const email = 'owner@asman.com';
  const passwordHash = await bcrypt.hash('1qazxsw2', 12);
  const owner = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      isEmailVerified: true,
      profile: { create: { name: 'Organization Owner' } },
      credentials: {
        create: { provider: 'EMAIL', providerId: email, passwordHash },
      },
    },
    update: { status: 'ACTIVE', isDeleted: false },
  });
  const existing = await prisma.organization.findFirst({ where: { email } });
  const organization =
    existing ??
    (await prisma.organization.create({
      data: {
        name: 'Asman Logistics',
        email,
        createdById: owner.id,
        status: 'ACTIVE',
      },
    }));

  if (existing && existing.status !== 'ACTIVE') {
    await prisma.organization.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE' },
    });
  }

  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId_role: {
        userId: owner.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    },
    create: {
      userId: owner.id,
      organizationId: organization.id,
      role: 'OWNER',
      createdById: owner.id,
    },
    update: { status: 'ACTIVE', removedAt: null },
  });
}
