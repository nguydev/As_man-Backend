import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';
import type { LiveLocation } from '@/modules/location/types/location.types';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDriverByUser(userId: string) {
    return this.prisma.driver.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
  }

  activeOrganizationIds(driverId: string) {
    return this.prisma.organizationMember.findMany({
      where: { driverId, role: 'DRIVER', status: 'ACTIVE' },
      select: { organizationId: true },
    });
  }

  driverInOrganization(driverId: string, organizationId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        driverId,
        organizationId,
        role: 'DRIVER',
        status: 'ACTIVE',
      },
    });
  }

  createHistory(points: LiveLocation[]) {
    const data: Prisma.LocationHistoryCreateManyInput[] = points.map(
      (point) => ({
        driverId: point.driverId,
        lat: point.lat,
        lon: point.lon,
        speed: point.speed,
        heading: point.heading,
        deviceTs: new Date(point.deviceTs),
        receivedTs: new Date(point.receivedTs),
      }),
    );
    return this.prisma.locationHistory.createMany({ data });
  }

  history(driverId: string, since: Date) {
    return this.prisma.locationHistory.findMany({
      where: { driverId, deviceTs: { gt: since } },
      orderBy: { deviceTs: 'asc' },
      take: 1000,
    });
  }

  createDetention(driverId: string, lat: number, lon: number) {
    return this.prisma.incidentAlert.create({
      data: { driverId, type: 'DETENTION', lat, lon },
    });
  }
}
