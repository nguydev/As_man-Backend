import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { seedAdmin } from './seeds/admin.seed';
import { seedDriver } from './seeds/driver.seed';
import { seedLegal } from './seeds/legal.seed';
import { seedNotifications } from './seeds/notification.seed';
import { seedOrganization } from './seeds/organization.seed';
import { seedLocationHistory } from './seeds/location.seed';
import { seedTemplates } from './seeds/template.seed';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

async function main(): Promise<void> {
  await seedAdmin(prisma);
  if (!process.argv.includes('--admin-only')) {
    await seedOrganization(prisma);
    await seedDriver(prisma);
    await seedLegal(prisma);
    await seedNotifications(prisma);
    await seedLocationHistory(prisma);
    await seedTemplates(prisma);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
