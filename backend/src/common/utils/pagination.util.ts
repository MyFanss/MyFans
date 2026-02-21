import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

/**
 * Paginate helper function for TypeORM
 * @param queryBuilder - TypeORM SelectQueryBuilder
 * @param paginationDto - Pagination parameters (page, limit)
 * @returns PaginatedResponseDto with data and pagination metadata
 */
export async function paginate<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  paginationDto: PaginationDto,
): Promise<PaginatedResponseDto<T>> {
  const { page = 1, limit = 20 } = paginationDto;
  const skip = (page - 1) * limit;

  const [data, total] = await queryBuilder
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  return new PaginatedResponseDto(data, total, page, limit);
}

/**
 * Paginate helper for TypeORM repositories using findAndCount
 * @param findAndCountResult - Tuple of [data, total] from repository.findAndCount()
 * @param paginationDto - Pagination parameters (page, limit)
 * @returns PaginatedResponseDto with data and pagination metadata
 */
export function createPaginatedResponse<T>(
  findAndCountResult: [T[], number],
  paginationDto: PaginationDto,
): PaginatedResponseDto<T> {
  const [data, total] = findAndCountResult;
  const { page = 1, limit = 20 } = paginationDto;

  return new PaginatedResponseDto(data, total, page, limit);
}
