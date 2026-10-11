import * as bcrypt from 'bcryptjs';
import type { PrismaClient } from '../generated/prisma/client';

export async function seedDriver(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash('1qazxsw2', 12);

  const drivers = [
    { email: 'driver1@asman.com', name: 'Alice Driver', plate: 'ASMAN-001' },
    { email: 'driver2@asman.com', name: 'Bob Driver', plate: 'ASMAN-002' },
    { email: 'driver3@asman.com', name: 'Charlie Driver', plate: 'ASMAN-003' },
    { email: 'driver4@asman.com', name: 'Diana Driver', plate: 'ASMAN-004' },
    { email: 'driver5@asman.com', name: 'Evan Driver', plate: 'ASMAN-005' },
  ];

  for (const d of drivers) {
    const user = await prisma.user.upsert({
      where: { email: d.email },
      create: {
        email: d.email,
        isEmailVerified: true,
        profile: { create: { name: d.name } },
        credentials: {
          create: { provider: 'EMAIL', providerId: d.email, passwordHash },
        },
      },
      update: { status: 'ACTIVE', isDeleted: false },
    });

    await prisma.driver.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        vinNumber: `1HGBH41JXMN10918${d.plate.slice(-1)}`,
        licensePlate: d.plate,
      },
      update: { status: 'ACTIVE' },
    });
  }
}
