import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

const OPEN_CASE_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'HEARING',
  'REOPENED',
] as const;

@Injectable()
export class OrganizationDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string) {
    const driverFilter = {
      organizationMembers: {
        some: {
          organizationId,
          role: 'DRIVER' as const,
          status: 'ACTIVE' as const,
        },
      },
    };

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const [
      activeDrivers,
      fleets,
      openCases,
      sosOpen,
      recentSos,
      activityRows,
    ] = await Promise.all([
      this.prisma.organizationMember.count({
        where: {
          organizationId,
          role: 'DRIVER',
          status: 'ACTIVE',
          driver: { status: 'ACTIVE' },
        },
      }),
      this.prisma.fleet.count({ where: { organizationId } }),
      this.prisma.case.count({
        where: {
          status: { in: [...OPEN_CASE_STATUSES] },
          driver: driverFilter,
        },
      }),
      this.prisma.incidentAlert.count({
        where: {
          type: 'SOS',
          status: { not: 'RESOLVED' },
          driver: driverFilter,
        },
      }),
      this.prisma.incidentAlert.findMany({
        where: {
          type: 'SOS',
          status: { not: 'RESOLVED' },
          driver: driverFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          message: true,
          status: true,
          createdAt: true,
          driver: {
            select: {
              user: {
                select: {
                  profile: { select: { name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.locationHistory.findMany({
        where: {
          deviceTs: { gte: weekStart },
          driver: driverFilter,
        },
        select: {
          driverId: true,
          deviceTs: true,
        },
      }),
    ]);

    return {
      stats: {
        activeDrivers,
        fleets,
        openCases,
        sosOpen,
      },
      driverActivity: this.buildDriverActivity(activityRows, weekStart),
      recentSos: recentSos.map((alarm) => ({
        id: alarm.id,
        name: alarm.driver.user.profile?.name ?? null,
        avatar: alarm.driver.user.profile?.avatarUrl ?? null,
        detail: alarm.message ?? 'SOS',
        status: alarm.status,
        timeAgo: this.timeAgo(alarm.createdAt),
        createdAt: alarm.createdAt,
      })),
    };
  }

  private buildDriverActivity(
    rows: Array<{ driverId: string; deviceTs: Date }>,
    weekStart: Date,
  ) {
    const dayKeys: string[] = [];
    const byDay = new Map<string, Set<string>>();

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      byDay.set(key, new Set());
    }

    for (const row of rows) {
      const key = row.deviceTs.toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (bucket) bucket.add(row.driverId);
    }

    return dayKeys.map((key) => {
      const date = new Date(`${key}T12:00:00.000Z`);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: key,
        active: byDay.get(key)?.size ?? 0,
      };
    });
  }

  private timeAgo(date: Date) {
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );
    if (seconds < 60) return `${seconds} sec ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
}
