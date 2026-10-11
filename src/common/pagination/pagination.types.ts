export type SortDirection = 'asc' | 'desc';

interface SortOptions {
  sortBy?: string;
  sortOrder?: SortDirection;
}

export interface OffsetPagination extends SortOptions {
  mode: 'offset';
  page: number;
  limit: number;
  skip: number;
}

export interface CursorPagination extends SortOptions {
  mode: 'cursor';
  limit: number;
  cursor?: string;
}

export type Pagination = OffsetPagination | CursorPagination;

export interface OffsetPaginationMeta {
  mode: 'offset';
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CursorPaginationMeta {
  mode: 'cursor';
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  hasNext: boolean;
}

export type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;

export interface PaginatedResult<T> {
  data: T;
  pagination: PaginationMeta;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}
