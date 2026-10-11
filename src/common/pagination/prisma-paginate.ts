import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma-client';
import locals from '@locals';
import { cursorPaginationMeta, offsetPaginationMeta } from './pagination.meta';
import type {
  PaginatedResult,
  Pagination,
  SortDirection,
} from './pagination.types';

type CursorPayload = {
  sortValue: unknown;
  cursorValue: unknown;
  sortBy?: string;
  sortOrder?: SortDirection;
};

type ModelDelegate = {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  count(args: Record<string, unknown>): Promise<number>;
};

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(token: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8'),
    ) as CursorPayload;
    if (
      parsed &&
      Object.prototype.hasOwnProperty.call(parsed, 'sortValue') &&
      Object.prototype.hasOwnProperty.call(parsed, 'cursorValue')
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function prismaPaginate<
  TDelegate,
  TArgs extends Prisma.Args<TDelegate, 'findMany'>,
>(
  delegate: TDelegate,
  args: TArgs,
  pagination?: Pagination,
  options?: {
    cursorField?: string;
    sortFields?: readonly string[];
    defaultSortField?: string;
    defaultSortDirection?: SortDirection;
  },
): Promise<PaginatedResult<Prisma.Result<TDelegate, TArgs, 'findMany'>>> {
  const model = delegate as unknown as ModelDelegate;
  const cursorField = options?.cursorField ?? 'id';
  const normalizedPagination = pagination || {
    mode: 'offset',
    page: 1,
    limit: 10,
    skip: 0,
  };
  const { limit } = normalizedPagination;
  const requestedSortField = normalizedPagination.sortBy;
  if (
    requestedSortField &&
    !options?.sortFields?.includes(requestedSortField)
  ) {
    throw new BadRequestException(locals.pagination.invalid_sort_field);
  }
  const activeSortField =
    requestedSortField ?? options?.defaultSortField ?? cursorField;
  const sortDirection =
    normalizedPagination.sortOrder ?? options?.defaultSortDirection ?? 'desc';
  const orderBy =
    activeSortField === cursorField
      ? { [cursorField]: sortDirection }
      : [
          { [activeSortField]: sortDirection },
          { [cursorField]: sortDirection },
        ];

  if (normalizedPagination.mode === 'cursor') {
    const cursorValue = normalizedPagination.cursor;
    const directionOp = sortDirection === 'asc' ? 'gt' : 'lt';

    let keysetWhere: Record<string, unknown> | undefined;
    if (cursorValue) {
      const decoded = decodeCursor(cursorValue);

      if (decoded) {
        if (
          (decoded.sortBy && decoded.sortBy !== activeSortField) ||
          (decoded.sortOrder && decoded.sortOrder !== sortDirection)
        ) {
          throw new BadRequestException(
            locals.pagination.invalid_cursor_token_for_sort_mode,
          );
        }
        // Composite keyset condition:
        // (sortField OP sortValue) OR (sortField == sortValue AND cursorField OP cursorValue)
        keysetWhere = {
          OR: [
            { [activeSortField]: { [directionOp]: decoded.sortValue } },
            {
              AND: [
                { [activeSortField]: decoded.sortValue },
                { [cursorField]: { [directionOp]: decoded.cursorValue } },
              ],
            },
          ],
        };
      } else if (activeSortField === cursorField) {
        // Backward compatibility for old plain cursor tokens.
        keysetWhere = {
          [cursorField]: { [directionOp]: cursorValue },
        };
      } else {
        throw new BadRequestException(
          locals.pagination.invalid_cursor_token_for_sort_mode,
        );
      }
    }

    const dataWithExtra = await model.findMany({
      ...args,
      take: limit + 1,
      where: keysetWhere
        ? args.where
          ? { AND: [args.where, keysetWhere] }
          : keysetWhere
        : args.where,
      orderBy,
    });
    const hasNext = dataWithExtra.length > limit;
    const data = hasNext ? dataWithExtra.slice(0, limit) : dataWithExtra;
    const lastItem = data[data.length - 1] as
      Record<string, unknown> | undefined;
    const nextCursor =
      hasNext && lastItem
        ? encodeCursor({
            sortValue: lastItem[activeSortField],
            cursorValue: lastItem[cursorField],
            sortBy: activeSortField,
            sortOrder: sortDirection,
          })
        : null;

    return {
      data: data as Prisma.Result<TDelegate, TArgs, 'findMany'>,
      pagination: cursorPaginationMeta(
        limit,
        hasNext,
        cursorValue ?? null,
        nextCursor && nextCursor.length > 0 ? nextCursor : null,
      ),
    };
  }

  const data = await model.findMany({
    ...args,
    skip: normalizedPagination.skip,
    take: limit,
    orderBy,
  });

  const total = await model.count({
    where: args.where,
  });

  return {
    data: data as Prisma.Result<TDelegate, TArgs, 'findMany'>,
    pagination: offsetPaginationMeta(total, normalizedPagination.page, limit),
  };
}
