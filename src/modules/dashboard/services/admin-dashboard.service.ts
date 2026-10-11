import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { PrismaTransactionService } from '@/database/prisma-transaction.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly transactions: PrismaTransactionService) {}

  async stats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.transactions.execute(async (client) => {
      const tx = client as Prisma.TransactionClient;

      const subscribers = await tx.subscription.count({
        where: { status: 'ACTIVE' },
      });
      const activeDrivers = await tx.driver.count({
        where: { status: 'ACTIVE' },
      });
      const fleets = await tx.organization.count({
        where: { status: 'ACTIVE' },
      });
      const attorneys = await tx.attorney.count();
      const sosToday = await tx.incidentAlert.count({
        where: { type: 'SOS', createdAt: { gte: today } },
      });
      const alarms = await tx.incidentAlert.findMany({
        where: { status: { not: 'RESOLVED' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          triggeredById: true,
          message: true,
          lat: true,
          lon: true,
          type: true,
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
      });

      return {
        stats: {
          subscribers,
          activeDrivers,
          fleets,
          attorneys,
          sosToday,
          inIceDetention: 0,
        },
        activeSosAlarms: alarms.map((alarm) => ({
          id: alarm.id,
          userId: alarm.triggeredById,
          userName: alarm.driver.user.profile?.name ?? null,
          userPhoto: alarm.driver.user.profile?.avatarUrl ?? null,
          detail: alarm.message ?? alarm.type,
          status: alarm.status,
          timeAgo: this.timeAgo(alarm.createdAt),
          lat: alarm.lat === null ? null : Number(alarm.lat),
          lng: alarm.lon === null ? null : Number(alarm.lon),
          createdAt: alarm.createdAt,
        })),
        enforcementAlerts: [],
        newsFeed: [],
        facilities: [],
        lastLocations: [],
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
