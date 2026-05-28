import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

/**
 * OpenAPI response shape for GET /users (cursor pagination).
 * Use this class in @ApiResponse({ type: ... }) so Swagger receives a runtime
 * constructor with a concrete `data` item type (avoid generic-only schemas).
 */
export class PaginatedUsersResponseDto {
  @ApiProperty({ description: 'Users for this page', type: [UserProfileDto] })
  data: UserProfileDto[];

  @ApiPropertyOptional({
    description: 'Cursor for next page (last item ID)',
    nullable: true,
  })
  cursor: string | null;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiPropertyOptional({ description: 'Cursor token for the next page', nullable: true })
  nextCursor: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page' })
  hasMore: boolean;

  @ApiPropertyOptional({ description: 'Total number of matching items (when known)' })
  total?: number;

  @ApiPropertyOptional({ description: 'Current page number (1-based), page-mode responses' })
  page?: number;

  @ApiPropertyOptional({ description: 'Total pages, page-mode responses' })
  totalPages?: number;
}
