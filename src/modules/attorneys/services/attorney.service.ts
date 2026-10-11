import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import type {
  CreateAttorneyDto,
  UpdateAttorneyDto,
} from '@/modules/attorneys/dto/attorney.dto';
import { AttorneyRepository } from '@/modules/attorneys/repositories/attorney.repository';
import locals from '@/locals';

@Injectable()
export class AttorneyService {
  constructor(private readonly attorneys: AttorneyRepository) {}

  async create(actorId: string, dto: CreateAttorneyDto) {
    try {
      return await this.attorneys.create({
        ...dto,
        createdById: actorId,
        verified: true,
      });
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  list(
    pagination: Pagination,
    filters: { search?: string; language?: string } = {},
  ) {
    return this.attorneys.list(pagination, filters);
  }

  async get(id: string) {
    const row = await this.attorneys.find(id);
    if (!row) throw new NotFoundException(locals.attorneys.not_found);
    return row;
  }

  async update(id: string, dto: UpdateAttorneyDto) {
    await this.get(id);
    try {
      return await this.attorneys.update(id, dto);
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.get(id);
    if (await this.attorneys.caseCount(id)) {
      throw new ConflictException(locals.attorneys.in_use);
    }
    return this.attorneys.remove(id);
  }

  private handleUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(locals.attorneys.unique_conflict);
    }
  }
}
