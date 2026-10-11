import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

const ATTORNEY_INCLUDE = {
  address: true,
  cases: {
    where: { outcome: 'WIN' },
    select: { id: true },
  },
  _count: {
    select: {
      cases: true,
    },
  },
} satisfies Prisma.AttorneyInclude;

type AttorneyWithCaseStatsInput = Prisma.AttorneyGetPayload<{
  include: typeof ATTORNEY_INCLUDE;
}>;

export interface CreateAttorneyInput {
  avatarUrl?: string | null;
  name: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  linkedin?: string;
  barLicenseNumber?: string;
  federalCircuit?: string;
  address?: Prisma.AddressCreateWithoutAttorneyInput;
  yearsOfExperience?: number;
  languageProficiencies?: string[];
  specialties: string[];
  states?: string[];
  courts?: string[];
  districts?: string[];
  about?: string;
  verified?: boolean;
  createdById: string;
}

export type UpdateAttorneyInput = Partial<
  Omit<CreateAttorneyInput, 'createdById'>
>;

export interface UpsertImportedAttorneyInput {
  externalId: string;
  externalSource: string;
  courtListenerId?: number | null;
  avatarUrl?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  website?: string | null;
  linkedin?: string | null;
  barLicenseNumber?: string | null;
  federalCircuit?: string | null;
  address?: Prisma.AddressCreateWithoutAttorneyInput;
  yearsOfExperience?: number;
  languageProficiencies?: string[];
  specialties: string[];
  states?: string[];
  courts?: string[];
  districts?: string[];
  about?: string | null;
  verified: boolean;
  remoteTotalCases?: number;
  remoteWonCases?: number;
  remoteLostCases?: number;
  remotePendingCases?: number;
  remoteWinRate?: number;
  lastCaseDate?: Date | null;
  lastImportedAt: Date;
}

@Injectable()
export class AttorneyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAttorneyInput) {
    const { address, createdById, ...data } = input;
    const attorney = await this.prisma.attorney.create({
      data: {
        ...data,
        address: address ? { create: address } : undefined,
        createdBy: { connect: { id: createdById } },
      },
      include: ATTORNEY_INCLUDE,
    });
    return this.withCaseStats(attorney);
  }

  async list(
    pagination: Pagination,
    filters: { search?: string; language?: string } = {},
  ) {
    const search = filters.search?.trim();
    const language = filters.language?.trim();
    const where: Prisma.AttorneyWhereInput = {
      ...(language
        ? { languageProficiencies: { has: language } }
        : undefined),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              {
                barLicenseNumber: { contains: search, mode: 'insensitive' },
              },
              {
                federalCircuit: { contains: search, mode: 'insensitive' },
              },
              { states: { has: search } },
              { districts: { has: search } },
              { specialties: { has: search } },
            ],
          }
        : undefined),
    };

    const result = await prismaPaginate(
      this.prisma.attorney,
      { where, include: ATTORNEY_INCLUDE, orderBy: { name: 'asc' } },
      pagination,
      {
        sortFields: [
          'name',
          'yearsOfExperience',
          'remoteWinRate',
          'remoteTotalCases',
          'lastCaseDate',
          'createdAt',
          'updatedAt',
        ],
        defaultSortField: 'name',
        defaultSortDirection: 'asc',
      },
    );
    return {
      ...result,
      data: result.data.map((attorney) =>
        this.withCaseStats(attorney as AttorneyWithCaseStatsInput),
      ),
    };
  }

  async find(id: string) {
    const attorney = await this.prisma.attorney.findUnique({
      where: { id },
      include: ATTORNEY_INCLUDE,
    });
    return attorney ? this.withCaseStats(attorney) : null;
  }

  findByExternalId(externalId: string) {
    return this.prisma.attorney.findUnique({
      where: { externalId },
      select: { id: true },
    });
  }

  findEmailOwner(email: string) {
    return this.prisma.attorney.findUnique({
      where: { email },
      select: { id: true, externalId: true },
    });
  }

  caseCount(id: string) {
    return this.prisma.case.count({ where: { attorneyId: id } });
  }

  async update(id: string, input: UpdateAttorneyInput) {
    const { address, ...data } = input;
    const attorney = await this.prisma.attorney.update({
      where: { id },
      data: {
        ...data,
        address: address
          ? { upsert: { create: address, update: address } }
          : undefined,
      },
      include: ATTORNEY_INCLUDE,
    });
    return this.withCaseStats(attorney);
  }

  async upsertByExternalId(input: UpsertImportedAttorneyInput) {
    const { address, externalId, ...data } = input;
    const attorney = await this.prisma.attorney.upsert({
      where: { externalId },
      create: {
        ...data,
        externalId,
        address: address ? { create: address } : undefined,
      },
      update: {
        ...data,
        address: address
          ? { upsert: { create: address, update: address } }
          : undefined,
      },
      include: ATTORNEY_INCLUDE,
    });
    return this.withCaseStats(attorney);
  }

  remove(id: string) {
    return this.prisma.attorney.delete({ where: { id } });
  }

  private withCaseStats(attorney: AttorneyWithCaseStatsInput) {
    const { cases, _count, ...data } = attorney;
    const platformTotal = _count.cases;
    const platformWins = cases.length;
    const remoteTotal = data.remoteTotalCases ?? 0;
    const useRemote = remoteTotal > 0;
    const totalCases = useRemote ? remoteTotal : platformTotal;
    const winCases = useRemote ? (data.remoteWonCases ?? 0) : platformWins;
    const winRatePct = useRemote
      ? Math.round((data.remoteWinRate ?? 0) * 100)
      : platformTotal > 0
        ? Math.round((platformWins / platformTotal) * 100)
        : 0;

    return {
      ...data,
      _count,
      totalCases,
      winCases,
      platformTotalCases: platformTotal,
      platformWinCases: platformWins,
      winRate: winRatePct,
      lostCases: useRemote ? (data.remoteLostCases ?? 0) : 0,
      pendingCases: useRemote ? (data.remotePendingCases ?? 0) : 0,
    };
  }
}
