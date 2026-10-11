import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { AttorneyRepository } from '@/modules/attorneys/repositories/attorney.repository';
import { AttorneyImportClientService } from '@/modules/attorneys/services/attorney-import-client.service';
import {
  ATTORNEY_IMPORT_SOURCE,
  type AttorneyImportResult,
  type RemoteAttorneyRecord,
} from '@/modules/attorneys/types/attorney-import.types';

const CITY_STATE_ZIP =
  /^(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/i;
const PHONE_OR_FAX =
  /^(?:fax[:\s]*|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|email:)/i;

@Injectable()
export class AttorneyImportService {
  private readonly logger = new Logger(AttorneyImportService.name);

  constructor(
    private readonly client: AttorneyImportClientService,
    private readonly attorneys: AttorneyRepository,
  ) {}

  async sync(): Promise<AttorneyImportResult> {
    const result: AttorneyImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const remote = await this.client.fetchFinalizedPage(page);
      totalPages = Math.max(remote.totalPages, 1);

      for (const record of remote.data) {
        try {
          const outcome = await this.importOne(record);
          result[outcome] += 1;
        } catch (error) {
          result.failed += 1;
          this.logger.warn(
            `Failed to import attorney ${record.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      page += 1;
    }

    this.logger.log(
      `Attorney import finished created=${result.created} updated=${result.updated} skipped=${result.skipped} failed=${result.failed}`,
    );
    return result;
  }

  private async importOne(
    record: RemoteAttorneyRecord,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const name = record.fullName?.trim();
    if (!name) return 'skipped';

    const existing = await this.attorneys.findByExternalId(record.id);
    const mapped = this.mapRecord(record, name);
    const email = await this.resolveEmail(mapped.email, existing?.id);
    try {
      await this.attorneys.upsertByExternalId({
        ...mapped,
        email: email ?? undefined,
      });
    } catch (error) {
      if (!this.isUniqueConflict(error) || !email) throw error;
      await this.attorneys.upsertByExternalId({
        ...mapped,
        email: undefined,
      });
    }
    return existing ? 'updated' : 'created';
  }

  private mapRecord(record: RemoteAttorneyRecord, name: string) {
    const specialties = this.pickStrings(
      record.practiceAreas,
      record.districts,
      record.courts,
    );
    const languages = this.normalizeList(record.languages);
    const states = this.normalizeList(record.states);
    const courts = this.normalizeList(record.courts);
    const districts = this.normalizeList(record.districts);
    const address = this.parseAddress(record.contactRaw, record.states);

    return {
      externalId: record.id,
      externalSource: ATTORNEY_IMPORT_SOURCE,
      courtListenerId: this.normalizeInt(record.courtListenerId),
      name,
      email: this.normalizeEmail(record.email),
      phone: this.trimOrNull(record.phone),
      fax: this.trimOrNull(record.fax),
      website: this.trimOrNull(record.website),
      linkedin: this.trimOrNull(record.linkedin),
      barLicenseNumber: this.trimOrNull(record.barNumber),
      avatarUrl: this.trimOrNull(record.photo),
      yearsOfExperience: Math.max(0, record.yearsExperience ?? 0),
      languageProficiencies: languages,
      specialties:
        specialties.length > 0 ? specialties : ['General Practice'],
      states,
      courts,
      districts,
      about:
        this.trimOrNull(record.professionalSummary) ??
        this.trimOrNull(record.biography),
      federalCircuit:
        this.trimOrNull(districts[0]) ?? this.trimOrNull(courts[0]),
      address,
      verified: true,
      remoteTotalCases: Math.max(0, record.totalCases ?? 0),
      remoteWonCases: Math.max(0, record.wonCases ?? 0),
      remoteLostCases: Math.max(0, record.lostCases ?? 0),
      remotePendingCases: Math.max(0, record.pendingCases ?? 0),
      remoteWinRate: this.normalizeWinRate(record.winRate),
      lastCaseDate: this.parseDate(record.lastCaseDate),
      lastImportedAt: new Date(),
    };
  }

  private async resolveEmail(
    email: string | null | undefined,
    ownerId?: string,
  ): Promise<string | null> {
    if (!email) return null;
    const owner = await this.attorneys.findEmailOwner(email);
    if (!owner) return email;
    if (ownerId && owner.id === ownerId) return email;
    return null;
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private parseAddress(
    contactRaw: string | null,
    states: string[] | null,
  ): Prisma.AddressCreateWithoutAttorneyInput | undefined {
    if (!contactRaw?.trim()) {
      const state = this.trimOrNull(states?.[0]);
      return state ? { state } : undefined;
    }

    const lines = contactRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !PHONE_OR_FAX.test(line));

    let city: string | undefined;
    let state: string | undefined;
    let zipCode: string | undefined;
    let cityLineIndex = -1;

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const match = lines[i]?.match(CITY_STATE_ZIP);
      if (!match) continue;
      city = match[1]?.replace(/,$/, '').trim();
      state = match[2]?.toUpperCase();
      zipCode = match[3];
      cityLineIndex = i;
      break;
    }

    const streetLines =
      cityLineIndex > 0
        ? lines.slice(1, cityLineIndex)
        : lines.length > 1
          ? lines.slice(1, Math.min(lines.length, 3))
          : [];
    const street = streetLines.join(', ').trim() || undefined;

    if (!street && !city && !state && !zipCode) {
      const fallbackState = this.trimOrNull(states?.[0]);
      return fallbackState ? { state: fallbackState } : undefined;
    }

    return {
      street,
      city,
      state: state ?? this.trimOrNull(states?.[0]) ?? undefined,
      zipCode,
    };
  }

  private pickStrings(...candidates: Array<string[] | null | undefined>) {
    for (const candidate of candidates) {
      const list = this.normalizeList(candidate);
      if (list.length) return list;
    }
    return [] as string[];
  }

  private normalizeList(values: string[] | null | undefined): string[] {
    if (!Array.isArray(values)) return [];
    return [
      ...new Set(
        values
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
          .map((value) => value.slice(0, 120)),
      ),
    ].slice(0, 20);
  }

  private normalizeEmail(value: string | null | undefined): string | null {
    const email = this.trimOrNull(value)?.toLowerCase();
    if (!email || !email.includes('@')) return null;
    return email.slice(0, 320);
  }

  private normalizeInt(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.trunc(value);
  }

  private normalizeWinRate(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private trimOrNull(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
