import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinksResponseDto } from './user-profile.dto';

/**
 * SocialLinksService
 *
 * Thin service that handles extracting and mapping social link fields.
 * Inject this into your UserService / CreatorService rather than
 * duplicating the mapping logic.
 */
@Injectable()
export class SocialLinksService {
  /**
   * Picks only social link fields from a DTO and returns a partial entity update object.
   */
  extractUpdatePayload(dto: SocialLinksDto): Partial<{
    websiteUrl: string | null;
    twitterHandle: string | null;
    instagramHandle: string | null;
    otherLink: string | null;
  }> {
    const payload: Record<string, string | null> = {};

    if ('websiteUrl' in dto) payload.websiteUrl = dto.websiteUrl ?? null;
    if ('twitterHandle' in dto) payload.twitterHandle = dto.twitterHandle ?? null;
    if ('instagramHandle' in dto) payload.instagramHandle = dto.instagramHandle ?? null;
    if ('otherLink' in dto) payload.otherLink = dto.otherLink ?? null;

    return payload;
  }

  /**
   * Maps entity social link fields to the response DTO shape.
   */
  toResponseDto(entity: {
    websiteUrl?: string | null;
    twitterHandle?: string | null;
    instagramHandle?: string | null;
    otherLink?: string | null;
  }): SocialLinksResponseDto {
    return {
      websiteUrl: entity.websiteUrl ?? null,
      twitterHandle: entity.twitterHandle ?? null,
      instagramHandle: entity.instagramHandle ?? null,
      otherLink: entity.otherLink ?? null,
    };
  }
}
