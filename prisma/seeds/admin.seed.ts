import * as bcrypt from 'bcryptjs';
import type { PrismaClient } from '../generated/prisma/client';

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const password = '1qazxsw2';
  if (!password || password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must contain at least 8 characters');
  }
  const email = 'admin@asman.com';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role: 'ADMIN',
      isEmailVerified: true,
      profile: { create: { name: 'Admin' } },
      credentials: {
        create: { provider: 'EMAIL', providerId: email, passwordHash },
      },
    },
    update: { role: 'ADMIN', status: 'ACTIVE', isDeleted: false },
  });
}
