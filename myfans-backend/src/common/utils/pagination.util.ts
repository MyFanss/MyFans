import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

/**
 * Paginate a TypeORM SelectQueryBuilder.
 */
export async function paginate<T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  paginationDto: PaginationQueryDto,
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
 * Create a PaginatedResponseDto from a TypeORM findAndCount result.
 */
export function createPaginatedResponse<T>(
  findAndCountResult: [T[], number],
  paginationDto: PaginationQueryDto,
): PaginatedResponseDto<T> {
  const [data, total] = findAndCountResult;
  const { page = 1, limit = 20 } = paginationDto;
  return new PaginatedResponseDto(data, total, page, limit);
}
