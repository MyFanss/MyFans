import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items', isArray: true })
  data: T[];

  @ApiPropertyOptional({ description: 'Cursor for next page (last item ID)', nullable: true })
  cursor: string | null;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiPropertyOptional({ description: 'Cursor for next page', nullable: true })
  nextCursor: string | null;

  @ApiProperty({ description: 'Whether there are more items' })
  hasMore: boolean;

  @ApiPropertyOptional({ description: 'Total number of matching items' })
  total: number;

  @ApiPropertyOptional({ description: 'Current page number (1-based)' })
  page: number;

  @ApiPropertyOptional({ description: 'Total number of pages' })
  totalPages: number;

  constructor(
    data: T[],
    limitOrTotal: number,
    nextCursorOrPage: string | number | null,
    hasmoreOrLimit: boolean | number,
    page?: number,
  ) {
    this.data = data;
    this.cursor = null;

    // Overload: (data, total, page, limit) — used by searchCreators
    if (typeof nextCursorOrPage === 'number' && typeof hasmoreOrLimit === 'number') {
      this.total = limitOrTotal;
      this.page = nextCursorOrPage;
      this.limit = hasmoreOrLimit;
      this.nextCursor = null;
      this.hasMore = this.page * this.limit < this.total;
      this.totalPages = Math.ceil(this.total / this.limit);
    } else {
      // Original: (data, limit, nextCursor, hasMore)
      this.limit = limitOrTotal;
      this.nextCursor = nextCursorOrPage as string | null;
      this.hasMore = hasmoreOrLimit as boolean;
      this.total = data.length;
      this.page = page ?? 1;
      this.totalPages = 1;
    }
  }
}
