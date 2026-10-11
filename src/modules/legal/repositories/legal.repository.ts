import { Injectable } from '@nestjs/common';
import type { LegalType, Prisma } from '@prisma-client';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class LegalRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(data: { type: LegalType; content: Prisma.InputJsonValue }) {
    return this.prisma.legal.upsert({
      where: { type: data.type },
      update: data,
      create: data,
    });
  }

  list() {
    return this.prisma.legal.findMany({ orderBy: { type: 'asc' } });
  }

  find(type: LegalType) {
    return this.prisma.legal.findUnique({ where: { type } });
  }
}
