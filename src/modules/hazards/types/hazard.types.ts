import type { HazardRow } from '@/modules/hazards/repositories/hazard.repository';

export const HAZARD_PUBLIC_NAME = 'Police/ICE report';
export const HAZARD_PUBLIC_DETAIL =
  'Community report — not a verified law-enforcement location';

export const MERGE_RADIUS_METERS = 400;
export const TTL_HOURS = 3;
export const COOLDOWN_SECONDS = 120;

export type HazardPublicPayload = {
  id: string;
  role: 'HAZARD';
  type: 'POLICE_ICE';
  status: string;
  lat: number;
  lng: number;
  name: string;
  detail: string;
  confirmCount: number;
  clearCount: number;
  radiusMeters: number;
  lastReportedAt: string;
  expiresAt: string;
  merged?: boolean;
};

export function toPublicHazard(
  row: HazardRow,
  extras?: { merged?: boolean },
): HazardPublicPayload {
  return {
    id: row.id,
    role: 'HAZARD',
    type: 'POLICE_ICE',
    status: row.status,
    lat: Number(row.lat),
    lng: Number(row.lon),
    name: HAZARD_PUBLIC_NAME,
    detail: HAZARD_PUBLIC_DETAIL,
    confirmCount: row.confirmCount,
    clearCount: row.clearCount,
    radiusMeters: row.radiusMeters,
    lastReportedAt: row.lastReportedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ...(extras?.merged !== undefined ? { merged: extras.merged } : {}),
  };
}

export function metersBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const earthMeters = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthMeters * Math.asin(Math.sqrt(a));
}

export function shouldClear(confirmCount: number, clearCount: number) {
  return clearCount >= 2 || clearCount >= confirmCount;
}

export function ttlFrom(now = new Date()) {
  return new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);
}
