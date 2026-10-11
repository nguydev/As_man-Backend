import type { Prisma, PrismaClient } from '../generated/prisma/client';

/** NYC metro hub — one viewport shows org, attorney, drivers, and SOS. */
const MAP_HUB = {
  lat: 40.7128,
  lon: -74.006,
  city: 'New York',
  state: 'NY',
} as const;

const DRIVER_OFFSETS = [
  { dLat: 0.012, dLon: 0.008 },
  { dLat: -0.01, dLon: 0.015 },
  { dLat: 0.018, dLon: -0.012 },
  { dLat: -0.015, dLon: -0.008 },
  { dLat: 0.005, dLon: 0.02 },
] as const;

export async function seedLocationHistory(prisma: PrismaClient): Promise<void> {
  const organization = await prisma.organization.findFirst({
    where: { email: 'owner@asman.com' },
  });
  if (!organization) {
    console.warn('Organization not found, skipping map location seeding.');
    return;
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: { status: 'ACTIVE' },
  });

  await prisma.address.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      street: '1 World Trade Center',
      city: MAP_HUB.city,
      state: MAP_HUB.state,
      zipCode: '10007',
      latitude: String(MAP_HUB.lat),
      longitude: String(MAP_HUB.lon),
    },
    update: {
      street: '1 World Trade Center',
      city: MAP_HUB.city,
      state: MAP_HUB.state,
      zipCode: '10007',
      latitude: String(MAP_HUB.lat),
      longitude: String(MAP_HUB.lon),
    },
  });

  const driverEmails = [
    'driver1@asman.com',
    'driver2@asman.com',
    'driver3@asman.com',
    'driver4@asman.com',
    'driver5@asman.com',
  ];

  const users = await prisma.user.findMany({
    where: { email: { in: driverEmails } },
    include: { driver: true },
  });

  const drivers = users
    .map((user) => user.driver)
    .filter((driver): driver is NonNullable<typeof driver> => driver !== null);

  if (drivers.length === 0) {
    console.warn('No drivers found, skipping location history seeding.');
    return;
  }

  for (const user of users) {
    if (!user.driver) continue;
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId_role: {
          userId: user.id,
          organizationId: organization.id,
          role: 'DRIVER',
        },
      },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: 'DRIVER',
        driverId: user.driver.id,
        createdById: organization.createdById ?? undefined,
      },
      update: {
        status: 'ACTIVE',
        removedAt: null,
        driverId: user.driver.id,
      },
    });
  }

  const attorney = await prisma.attorney.upsert({
    where: { email: 'attorney@asman.com' },
    create: {
      name: 'Alex Counsel',
      email: 'attorney@asman.com',
      specialties: ['Transportation'],
      states: ['NY'],
      verified: true,
      createdById: organization.createdById ?? undefined,
    },
    update: {
      name: 'Alex Counsel',
      specialties: ['Transportation'],
      states: ['NY'],
      verified: true,
    },
  });

  await prisma.address.upsert({
    where: { attorneyId: attorney.id },
    create: {
      attorneyId: attorney.id,
      street: '100 Centre Street',
      city: MAP_HUB.city,
      state: MAP_HUB.state,
      zipCode: '10013',
      latitude: String(MAP_HUB.lat + 0.008),
      longitude: String(MAP_HUB.lon + 0.006),
    },
    update: {
      street: '100 Centre Street',
      city: MAP_HUB.city,
      state: MAP_HUB.state,
      zipCode: '10013',
      latitude: String(MAP_HUB.lat + 0.008),
      longitude: String(MAP_HUB.lon + 0.006),
    },
  });

  const leadDriver = drivers[0];
  const existingCase = await prisma.case.findFirst({
    where: { driverId: leadDriver.id, attorneyId: attorney.id },
  });
  if (!existingCase) {
    await prisma.case.create({
      data: {
        driverId: leadDriver.id,
        attorneyId: attorney.id,
        status: 'OPEN',
        court: 'SDNY',
        summary: 'Seed map attorney case',
        createdById: organization.createdById ?? undefined,
      },
    });
  }

  await prisma.locationHistory.deleteMany({
    where: { driverId: { in: drivers.map((driver) => driver.id) } },
  });

  const locations: Prisma.LocationHistoryCreateManyInput[] = [];
  const now = new Date();

  drivers.forEach((driver, index) => {
    const offset = DRIVER_OFFSETS[index % DRIVER_OFFSETS.length];
    const endLat = MAP_HUB.lat + offset.dLat;
    const endLon = MAP_HUB.lon + offset.dLon;

    for (let i = 0; i < 40; i++) {
      const t = i / 39;
      const lat = MAP_HUB.lat + (endLat - MAP_HUB.lat) * t;
      const lon = MAP_HUB.lon + (endLon - MAP_HUB.lon) * t;
      const deviceTs = new Date(now.getTime() - (40 - i) * 60 * 1000);

      locations.push({
        driverId: driver.id,
        lat,
        lon,
        speed: 25 + Math.random() * 20,
        heading: (Math.atan2(endLon - MAP_HUB.lon, endLat - MAP_HUB.lat) * 180) /
          Math.PI,
        deviceTs,
        receivedTs: new Date(deviceTs.getTime() + 1000),
      });
    }
  });

  await prisma.locationHistory.createMany({ data: locations });

  await prisma.incidentAlert.deleteMany({
    where: {
      driverId: leadDriver.id,
      type: 'SOS',
      status: { not: 'RESOLVED' },
    },
  });

  await prisma.incidentAlert.create({
    data: {
      driverId: leadDriver.id,
      type: 'SOS',
      status: 'OPEN',
      lat: MAP_HUB.lat + DRIVER_OFFSETS[0].dLat,
      lon: MAP_HUB.lon + DRIVER_OFFSETS[0].dLon,
      message: 'Seed SOS pin for map viewport',
      triggeredById: users.find((user) => user.driver?.id === leadDriver.id)?.id,
    },
  });

  console.log(
    `Seeded map viewport around ${MAP_HUB.city}: ${drivers.length} drivers, org+attorney addresses, ${locations.length} history points, 1 SOS.`,
  );
  console.log(
    `Try: GET /api/v1/map/locations?north=40.75&south=40.68&east=-73.96&west=-74.05&zoom=12 as owner@asman.com`,
  );
}
