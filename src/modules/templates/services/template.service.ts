import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pagination } from '@/common/pagination/pagination.types';
import type {
  CreateTemplateDto,
  UpdateTemplateDto,
} from '@/modules/templates/dto/template.dto';
import { TemplateRepository } from '@/modules/templates/repositories/template.repository';
import locals from '@/locals';

@Injectable()
export class TemplateService {
  constructor(private readonly templates: TemplateRepository) {}

  async create(actorId: string, dto: CreateTemplateDto) {
    try {
      return await this.templates.create({
        title: dto.title,
        content: dto.content,
        addedById: actorId,
      });
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  list(pagination: Pagination, filters: { search?: string } = {}) {
    return this.templates.list(pagination, filters);
  }

  async get(id: string) {
    const row = await this.templates.find(id);
    if (!row) throw new NotFoundException(locals.templates.not_found);
    return row;
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.get(id);
    try {
      return await this.templates.update(id, dto);
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.get(id);
    return this.templates.remove(id);
  }

  private handleUniqueConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(locals.templates.title_conflict);
    }
  }
}
