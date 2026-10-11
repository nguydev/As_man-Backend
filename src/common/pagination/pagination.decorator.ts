import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function ApiPaginationQuery(sortFields: readonly string[]) {
  return applyDecorators(
    ApiQuery({
      name: 'cursor',
      required: false,
      type: String,
      description: 'Cursor returned by the previous page',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      minimum: 1,
      description: 'Page number for offset pagination',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      minimum: 1,
      maximum: 150,
      description: 'Items per page',
    }),
    ApiQuery({
      name: 'sortBy',
      required: false,
      type: String,
      enum: [...sortFields],
      description: 'Field to sort by',
    }),
    ApiQuery({
      name: 'sortOrder',
      required: false,
      enum: ['asc', 'desc'],
      description: 'Sort direction',
    }),
  );
}
