import type { AuthenticatedUser } from '@/core/auth/types/authorization.type';

export interface LocationPing {
  lat: number;
  lon: number;
  speed?: number;
  heading?: number;
  deviceTs: string;
}
export interface LiveLocation extends LocationPing {
  driverId: string;
  receivedTs: string;
}

export interface LocationSocketData {
  user?: AuthenticatedUser;
  driverId?: string;
  dashboardSubscriberUserId?: string;
  adminSosSubscriber?: boolean;
}
