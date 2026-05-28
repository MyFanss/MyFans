import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

/**
 * Paginate helper function for TypeORM with cursor-based pagination
 * @param queryBuilder - TypeORM SelectQueryBuilder
 * @param paginationDto - Pagination parameters (cursor, limit)
 * @param idField - The field to use for cursor (default: 'id')
 * @returns PaginatedResponseDto with data and pagination metadata
 */
export async function paginate<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  paginationDto: PaginationDto,
  idField: keyof T = 'id' as keyof T,
): Promise<PaginatedResponseDto<T>> {
  const { cursor, limit = 20 } = paginationDto;

  if (cursor) {
    const cursorId = parseInt(cursor, 10);
    if (!isNaN(cursorId)) {
      queryBuilder.andWhere(`${idField as string} > :cursorId`, { cursorId });
    }
  }

  queryBuilder.take(limit + 1);

  const data = await queryBuilder.getMany();
  const hasMore = data.length > limit;
  
  if (hasMore) {
    data.pop();
  }

  let nextCursor: string | null = null;
  if (data.length > 0) {
    const lastItem = data[data.length - 1];
    const cursorValue = lastItem[idField];
    nextCursor = String(cursorValue);
  }

  return new PaginatedResponseDto(data, limit, nextCursor, hasMore);
}

/**
 * Paginate helper for TypeORM repositories using findAndCount
 * @param data - Array of items from repository
 * @param paginationDto - Pagination parameters (cursor, limit)
 * @param hasMore - Whether there are more items
 * @returns PaginatedResponseDto with data and pagination metadata
 */
export function createPaginatedResponse<T>(
  data: T[],
  paginationDto: PaginationDto,
  hasMore: boolean,
): PaginatedResponseDto<T> {
  const { limit = 20 } = paginationDto;
  let nextCursor: string | null = null;

  if (data.length > 0) {
    const lastItem = data[data.length - 1] as Record<string, unknown>;
    if (lastItem && 'id' in lastItem) {
      nextCursor = String(lastItem.id);
    }
  }

  return new PaginatedResponseDto(data, limit, nextCursor, hasMore);
}
