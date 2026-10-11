import type { PrismaClient } from '../generated/prisma/client';

const titles = [
  'Welcome to Asman',
  'Driver invite accepted',
  'SOS test incident received',
  'Subscription reminder',
];

export async function seedNotifications(prisma: PrismaClient): Promise<void> {
  const [admin, owner, driver, organization] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@asman.com' } }),
    prisma.user.findUnique({ where: { email: 'owner@asman.com' } }),
    prisma.user.findUnique({ where: { email: 'driver@asman.com' } }),
    prisma.organization.findFirst({ where: { email: 'owner@asman.com' } }),
  ]);

  await prisma.notification.deleteMany({
    where: { title: { in: titles } },
  });

  await prisma.notification.createMany({
    data: [
      ...(admin
        ? [
            {
              audience: 'SYSTEM' as const,
              userId: admin.id,
              title: 'SOS test incident received',
              body: 'A seeded SOS alert is ready for admin notification UI testing.',
              channels: ['IN_APP' as const],
              isDelivered: true,
              deliveredAt: new Date(),
              data: { seed: true, type: 'SOS' },
            },
          ]
        : []),
      ...(owner && organization
        ? [
            {
              audience: 'ORGANIZATION' as const,
              userId: owner.id,
              organizationId: organization.id,
              title: 'Driver invite accepted',
              body: 'Seed Driver joined Asman Logistics.',
              channels: ['IN_APP' as const, 'PUSH' as const],
              isDelivered: true,
              deliveredAt: new Date(),
              data: { seed: true, organizationId: organization.id },
            },
            {
              audience: 'ORGANIZATION' as const,
              userId: owner.id,
              organizationId: organization.id,
              title: 'Subscription reminder',
              body: 'Your seeded fleet subscription renewal is coming up.',
              channels: ['IN_APP' as const],
              readAt: new Date(),
              isDelivered: true,
              deliveredAt: new Date(),
              data: { seed: true },
            },
          ]
        : []),
      ...(driver
        ? [
            {
              audience: 'USER' as const,
              userId: driver.id,
              title: 'Welcome to Asman',
              body: 'Your seeded driver account is ready.',
              channels: ['IN_APP' as const],
              isDelivered: true,
              deliveredAt: new Date(),
              data: { seed: true },
            },
          ]
        : []),
    ],
  });
}
