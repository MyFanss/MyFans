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

  constructor(data: T[], limit: number, nextCursor: string | null, hasMore: boolean) {
    this.data = data;
    this.cursor = null;
    this.limit = limit;
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
  }
}
