import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query DTO for a consistent, filterable creator posts listing.
 *
 * `content.controller.ts`'s `GET creator/:creatorId` currently accepts
 * only `PaginationDto` and `content.service.ts#findByCreator` has no
 * visibility filter — callers always get every post regardless of
 * `is_published` / gating. This DTO adds the missing filter so a
 * follow-up change can wire it into `findByCreator` without changing
 * the existing signature's behavior for callers that omit `visibility`.
 */
export enum CreatorPostVisibility {
  /** Published, ungated posts only. */
  PUBLIC = 'public',
  /** Published posts gated behind a subscription_tier. */
  SUBSCRIBERS = 'subscribers',
  /** Unpublished drafts (creator-only view). */
  DRAFT = 'draft',
  /** No filter — every post regardless of visibility (current behavior). */
  ALL = 'all',
}

export class CreatorPostsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: CreatorPostVisibility,
    default: CreatorPostVisibility.ALL,
    description: 'Filter creator posts by visibility',
  })
  @IsOptional()
  @IsEnum(CreatorPostVisibility)
  visibility?: CreatorPostVisibility = CreatorPostVisibility.ALL;
}
