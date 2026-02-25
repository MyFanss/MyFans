import { Injectable, BadRequestException } from '@nestjs/common';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinksResponseDto } from './user-profile.dto';
import { isAllowedDomain, ALLOWED_DOMAINS } from './social-links.validator';

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
  /**
   * Validates that all URL-type social link fields in the DTO belong
   * to an allowed domain. Throws BadRequestException otherwise.
   *
   * This acts as a service-layer guard in addition to the DTO-level
   * @IsAllowedDomain decorator, ensuring that no disallowed URLs
   * reach the persistence layer.
   */
  validateDomainAllowlist(dto: SocialLinksDto): void {
    const urlFields: { key: keyof SocialLinksDto; label: string }[] = [
      { key: 'websiteUrl', label: 'website_url' },
      { key: 'otherLink', label: 'other_link' },
    ];

    for (const { key, label } of urlFields) {
      const value = dto[key];
      if (value !== undefined && value !== null && value !== '') {
        if (!isAllowedDomain(value)) {
          throw new BadRequestException(
            `${label} domain is not allowed. Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`,
          );
        }
      }
    }
  }

  /**
   * Picks only social link fields from a DTO and returns a partial entity update object.
   * Rejects disallowed domains before building the payload.
   */
  extractUpdatePayload(dto: SocialLinksDto): Partial<{
    websiteUrl: string | null;
    twitterHandle: string | null;
    instagramHandle: string | null;
    otherLink: string | null;
  }> {
    // Service-layer domain allowlist guard
    this.validateDomainAllowlist(dto);

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
