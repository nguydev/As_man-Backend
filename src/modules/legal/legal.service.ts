import { Injectable, NotFoundException } from '@nestjs/common';
import { LegalType, type Prisma } from '@prisma-client';
import type { CreateLegalDto } from '@/modules/legal/dto/create-legal.dto';
import { LegalRepository } from '@/modules/legal/repositories/legal.repository';
import locals from '@/locals';

@Injectable()
export class LegalService {
  constructor(private readonly legal: LegalRepository) {}

  upsert(dto: CreateLegalDto) {
    return this.legal.upsert({
      type: dto.type,
      content: this.contentForDb(dto) as Prisma.InputJsonValue,
    });
  }

  findAll() {
    return this.legal.list();
  }

  async findOne(type: LegalType) {
    const row = await this.legal.find(type);
    if (!row) throw new NotFoundException(locals.legal.not_found);
    return row;
  }

  private contentForDb(dto: CreateLegalDto) {
    if (dto.type !== LegalType.FAQ || !Array.isArray(dto.content)) {
      return dto.content;
    }

    return dto.content.map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
      sequence: item.sequence,
    }));
  }
}
