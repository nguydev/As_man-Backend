import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { LiveLocation } from '@/modules/location/types/location.types';

export const MAP_ADMIN_LOCATIONS_ROOM = 'map:admin:locations';
export const ADMIN_SOS_ROOM = 'admin:sos';

@Injectable()
export class LocationFanoutService {
  private server?: Namespace;
  private readonly dashboardSubscribers = new Map<string, number>();

  attach(server: Namespace) {
    this.server = server;
  }

  subscribeDashboard(userId: string) {
    this.dashboardSubscribers.set(
      userId,
      (this.dashboardSubscribers.get(userId) ?? 0) + 1,
    );
  }

  unsubscribeDashboard(userId: string) {
    const count = (this.dashboardSubscribers.get(userId) ?? 0) - 1;
    if (count > 0) {
      this.dashboardSubscribers.set(userId, count);
      return;
    }
    this.dashboardSubscribers.delete(userId);
  }

  dashboardSubscriberCount() {
    return this.dashboardSubscribers.size;
  }

  dashboardSubscriberIds() {
    return new Set(this.dashboardSubscribers.keys());
  }

  locations(orgIds: string[], point: LiveLocation) {
    this.server?.to(MAP_ADMIN_LOCATIONS_ROOM).emit('location:update', point);
    for (const id of orgIds)
      this.server?.to(`org:${id}:locations`).emit('location:update', point);
  }
  sos(orgIds: string[], payload: unknown) {
    this.server?.to(ADMIN_SOS_ROOM).emit('sos:alert', payload);
    for (const id of orgIds)
      this.server?.to(`org:${id}:sos`).emit('sos:alert', payload);
  }

  hazard(orgIds: string[], payload: unknown) {
    this.server?.to(MAP_ADMIN_LOCATIONS_ROOM).emit('hazard:upsert', payload);
    for (const id of orgIds)
      this.server?.to(`org:${id}:locations`).emit('hazard:upsert', payload);
  }

  hazardCleared(orgIds: string[], payload: { id: string }) {
    this.server?.to(MAP_ADMIN_LOCATIONS_ROOM).emit('hazard:cleared', payload);
    for (const id of orgIds)
      this.server?.to(`org:${id}:locations`).emit('hazard:cleared', payload);
  }
}
