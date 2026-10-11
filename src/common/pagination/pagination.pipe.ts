import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import locals from '@locals';
import { createPagination } from '@/common/pagination/pagination.util';
import type {
  Pagination,
  SortDirection,
} from '@/common/pagination/pagination.types';

@Injectable()
export class PaginationPipe implements PipeTransform {
  transform(value: unknown): Pagination {
    const maxLimit = 150;
    const query = this.query(value);
    const hasPageParam = 'page' in query;
    const page = this.integer(query.page, 1);
    const limit = this.integer(query.limit, 10);
    const cursor =
      typeof query.cursor === 'string' && query.cursor.trim().length > 0
        ? query.cursor.trim()
        : undefined;
    const sortBy =
      typeof query.sortBy === 'string' && query.sortBy.trim().length > 0
        ? query.sortBy.trim()
        : undefined;
    const sortOrder = this.sortOrder(query.sortOrder);

    if (!cursor && (!Number.isInteger(page) || page < 1)) {
      throw new BadRequestException(locals.pagination.page_must_be_at_least_1);
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
      throw new BadRequestException(
        locals.pagination.limit_must_be_between_1_and_150,
      );
    }

    if (cursor && hasPageParam) {
      throw new BadRequestException(
        locals.pagination.page_cannot_be_combined_with_cursor,
      );
    }

    return createPagination(
      page,
      limit,
      cursor,
      !hasPageParam,
      sortBy,
      sortOrder,
    );
  }

  private query(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private integer(value: unknown, fallback: number): number {
    if (value === undefined || value === '') return fallback;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  private sortOrder(value: unknown): SortDirection | undefined {
    if (value === undefined || value === '') return undefined;
    if (value === 'asc' || value === 'desc') return value;
    throw new BadRequestException(locals.pagination.invalid_sort_order);
  }
}
