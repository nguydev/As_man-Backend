import type {
  Pagination,
  SortDirection,
} from '@/common/pagination/pagination.types';

export function createPagination(
  page: number = 1,
  limit: number = 10,
  cursor?: string,
  preferCursor: boolean = false,
  sortBy?: string,
  sortOrder?: SortDirection,
): Pagination {
  const maxLimit = 150;
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.max(1, Math.min(maxLimit, limit));

  if (cursor || preferCursor) {
    return {
      mode: 'cursor',
      limit: normalizedLimit,
      cursor,
      sortBy,
      sortOrder,
    };
  }

  const skip = (normalizedPage - 1) * normalizedLimit;

  return {
    mode: 'offset',
    page: normalizedPage,
    limit: normalizedLimit,
    skip,
    sortBy,
    sortOrder,
  };
}
