import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import { prismaPaginate } from '@/common/pagination/prisma-paginate';
import type { Pagination } from '@/common/pagination/pagination.types';
import { PrismaService } from '@/database/prisma.service';

const TEMPLATE_INCLUDE = {
  addedBy: {
    select: {
      id: true,
      email: true,
      profile: { select: { name: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.TemplateInclude;

export interface CreateTemplateInput {
  title: string;
  content: string;
  addedById: string;
}

export type UpdateTemplateInput = Partial<
  Omit<CreateTemplateInput, 'addedById'>
>;

@Injectable()
export class TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateTemplateInput) {
    return this.prisma.template.create({
      data,
      include: TEMPLATE_INCLUDE,
    });
  }

  list(pagination: Pagination, filters: { search?: string } = {}) {
    const where: Prisma.TemplateWhereInput = filters.search
      ? { title: { contains: filters.search, mode: 'insensitive' } }
      : {};

    return prismaPaginate(
      this.prisma.template,
      {
        where,
        include: TEMPLATE_INCLUDE,
        orderBy: { createdAt: 'desc' },
      },
      pagination,
      {
        sortFields: ['title', 'createdAt', 'updatedAt'],
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
      },
    );
  }

  find(id: string) {
    return this.prisma.template.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
  }

  update(id: string, data: UpdateTemplateInput) {
    return this.prisma.template.update({
      where: { id },
      data,
      include: TEMPLATE_INCLUDE,
    });
  }

  remove(id: string) {
    return this.prisma.template.delete({ where: { id } });
  }
}
