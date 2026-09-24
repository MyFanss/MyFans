import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Allowed URL schemes for profile social links.
 * Only https is permitted to prevent open redirects and javascript: XSS.
 */
const ALLOWED_SCHEMES = ['https:'];

/** Maximum length of a stored social link URL. */
export const MAX_SOCIAL_LINK_URL_LENGTH = 2048;

/** Maximum length of the platform/label identifier. */
export const MAX_SOCIAL_LINK_PLATFORM_LENGTH = 64;

export interface SocialLink {
  id: string;
  userId: string;
  platform: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSocialLinkInput {
  platform: string;
  url: string;
}

export interface UpdateSocialLinkInput {
  platform?: string;
  url?: string;
}

/**
 * Validates and sanitizes a social link URL.
 *
 * Rejects:
 * - non-string / empty values
 * - overlong values
 * - any scheme other than https (e.g. javascript:, data:, http:)
 * - malformed URLs
 *
 * Returns the normalized (trimmed) URL on success.
 */
export function sanitizeSocialLinkUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') {
    throw new BadRequestException('url must be a string');
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length === 0) {
    throw new BadRequestException('url must not be empty');
  }

  if (trimmed.length > MAX_SOCIAL_LINK_URL_LENGTH) {
    throw new BadRequestException(
      `url must be at most ${MAX_SOCIAL_LINK_URL_LENGTH} characters`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('url must be a valid absolute URL');
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw new BadRequestException(
      `url scheme must be one of: ${ALLOWED_SCHEMES.join(', ')}`,
    );
  }

  if (!parsed.hostname) {
    throw new BadRequestException('url must include a hostname');
  }

  return parsed.toString();
}

function sanitizePlatform(rawPlatform: unknown): string {
  if (typeof rawPlatform !== 'string') {
    throw new BadRequestException('platform must be a string');
  }

  const trimmed = rawPlatform.trim();

  if (trimmed.length === 0) {
    throw new BadRequestException('platform must not be empty');
  }

  if (trimmed.length > MAX_SOCIAL_LINK_PLATFORM_LENGTH) {
    throw new BadRequestException(
      `platform must be at most ${MAX_SOCIAL_LINK_PLATFORM_LENGTH} characters`,
    );
  }

  return trimmed;
}

/**
 * In-memory CRUD service for profile social links.
 *
 * URL validation/sanitization is enforced on every write so that unsafe
 * schemes (javascript:, data:, http:) and overlong inputs are rejected.
 * The PATCH endpoint is additionally throttled to 5 requests/minute at the
 * controller layer.
 */
@Injectable()
export class SocialLinksService {
  private readonly links = new Map<string, SocialLink>();
  private sequence = 0;

  list(userId: string): SocialLink[] {
    return Array.from(this.links.values()).filter(
      (link) => link.userId === userId,
    );
  }

  findOne(userId: string, id: string): SocialLink {
    const link = this.links.get(id);

    if (!link || link.userId !== userId) {
      throw new NotFoundException('social link not found');
    }

    return link;
  }

  create(userId: string, input: CreateSocialLinkInput): SocialLink {
    const platform = sanitizePlatform(input?.platform);
    const url = sanitizeSocialLinkUrl(input?.url);

    const now = new Date();
    const link: SocialLink = {
      id: `sl_${++this.sequence}`,
      userId,
      platform,
      url,
      createdAt: now,
      updatedAt: now,
    };

    this.links.set(link.id, link);
    return link;
  }

  update(userId: string, id: string, input: UpdateSocialLinkInput): SocialLink {
    const existing = this.findOne(userId, id);

    const platform =
      input?.platform === undefined
        ? existing.platform
        : sanitizePlatform(input.platform);

    const url =
      input?.url === undefined
        ? existing.url
        : sanitizeSocialLinkUrl(input.url);

    const updated: SocialLink = {
      ...existing,
      platform,
      url,
      updatedAt: new Date(),
    };

    this.links.set(id, updated);
    return updated;
  }

  remove(userId: string, id: string): void {
    this.findOne(userId, id);
    this.links.delete(id);
  }
}
