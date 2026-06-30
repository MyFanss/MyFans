import { Injectable, BadRequestException } from '@nestjs/common';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinksResponseDto, SocialLinksListItemDto } from './user-profile.dto';
import {
  isAllowedDomain,
  getAllowedDomains,
  isDomainAllowlistEnabled,
  getUrlHostname,
} from './social-links.validator';

type SocialLinksPayload = Partial<{
  websiteUrl: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  otherLink: string | null;
}>;

export type SocialLinksListItem = SocialLinksListItemDto;

/**
 * SocialLinksService
 *
 * Thin service that handles extracting and mapping social link fields.
 * Inject this into your UserService / CreatorService rather than
 * duplicating the mapping logic.
 *
 * Includes a domain allowlist check as a second line of defense
 * (the DTO decorator handles the first line).
 */
@Injectable()
export class SocialLinksService {
  private readonly records = new Map<string, SocialLinksListItem>();
  private nextId = 1;

  /**
   * Validates that all URL-type social link fields in the DTO belong
   * to an allowed domain. Throws BadRequestException otherwise.
   *
   * This acts as a service-layer guard in addition to the DTO-level
   * @IsAllowedDomain decorator, ensuring that no disallowed URLs
   * reach the persistence layer.
   */
  validateDomainAllowlist(dto: SocialLinksDto): void {
    if (!isDomainAllowlistEnabled()) {
      return;
    }

    const allowed = getAllowedDomains();
    const urlFields: { key: keyof SocialLinksDto; label: string }[] = [
      { key: 'websiteUrl', label: 'website_url' },
      { key: 'otherLink', label: 'other_link' },
    ];

    for (const { key, label } of urlFields) {
      const value = dto[key];
      if (value !== undefined && value !== null && value !== '') {
        if (!isAllowedDomain(value)) {
          const hostname = getUrlHostname(value) ?? 'unknown';
          throw new BadRequestException(
            `${label} domain "${hostname}" is not allowed. Allowed domains: ${allowed.join(', ')}`,
          );
        }
      }
    }
  }

  /**
   * Picks only social link fields from a DTO and returns a partial entity update object.
   * Rejects disallowed domains before building the payload.
   */
  extractUpdatePayload(dto: SocialLinksDto): SocialLinksPayload {
    // Service-layer domain allowlist guard
    this.validateDomainAllowlist(dto);

    const payload: Record<string, string | null> = {};

    if ('websiteUrl' in dto) payload.websiteUrl = dto.websiteUrl ?? null;
    if ('twitterHandle' in dto)
      payload.twitterHandle = dto.twitterHandle ?? null;
    if ('instagramHandle' in dto)
      payload.instagramHandle = dto.instagramHandle ?? null;
    if ('otherLink' in dto) payload.otherLink = dto.otherLink ?? null;

    return payload;
  }

  createSocialLinks(dto: SocialLinksDto): SocialLinksPayload {
    const payload = this.extractUpdatePayload(dto);
    const id = String(this.nextId++);
    this.records.set(id, {
      id,
      ...this.toResponseDto(payload),
    });

    return payload;
  }

  updateSocialLinks(id: string, dto: SocialLinksDto): SocialLinksPayload {
    const payload = this.extractUpdatePayload(dto);
    const current = this.records.get(id) ?? {
      id,
      websiteUrl: null,
      twitterHandle: null,
      instagramHandle: null,
      otherLink: null,
    };

    this.records.set(id, {
      ...current,
      ...payload,
    });

    return payload;
  }

  listSocialLinks(
    pagination: PaginationDto = {},
  ): PaginatedResponseDto<SocialLinksListItem> {
    const page =
      Number.isInteger(pagination.page) &&
      pagination.page &&
      pagination.page > 0
        ? pagination.page
        : 1;
    const limit =
      Number.isInteger(pagination.limit) &&
      pagination.limit &&
      pagination.limit > 0
        ? Math.min(pagination.limit, 100)
        : 20;
    const skip = (page - 1) * limit;
    const allRecords = Array.from(this.records.values());
    const data = allRecords.slice(skip, skip + limit);

    return new PaginatedResponseDto(data, allRecords.length, page, limit);
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
