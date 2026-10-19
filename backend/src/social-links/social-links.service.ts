import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SocialLink } from './entities/social-link.entity';

/**
 * Allowed URL schemes for profile social links.
 * Only https is permitted to prevent open redirects and javascript: XSS.
 */
const ALLOWED_SCHEMES = ['https:'];

/** Maximum length of a stored social link URL. */
export const MAX_SOCIAL_LINK_URL_LENGTH = 2048;

/** Maximum length of the platform/label identifier. */
export const MAX_SOCIAL_LINK_PLATFORM_LENGTH = 64;

/** Maximum number of social links a single user may have. */
export const MAX_SOCIAL_LINKS_PER_USER = 10;

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
 * CRUD service for profile social links persisted via TypeORM.
 *
 * URL validation/sanitization is enforced on every write so that unsafe
 * schemes (javascript:, data:, http:) and overlong inputs are rejected.
 * The PATCH endpoint is additionally throttled to 5 requests/minute at the
 * controller layer.
 */
@Injectable()
export class SocialLinksService {
  constructor(
    @InjectRepository(SocialLink)
    private readonly socialLinkRepository: Repository<SocialLink>,
  ) {}

  async list(userId: string): Promise<SocialLink[]> {
    return this.socialLinkRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<SocialLink> {
    const link = await this.socialLinkRepository.findOne({
      where: { id, userId },
    });

    if (!link) {
      throw new NotFoundException('social link not found');
    }

    return link;
  }

  async create(userId: string, input: CreateSocialLinkInput): Promise<SocialLink> {
    const platform = sanitizePlatform(input?.platform);
    const url = sanitizeSocialLinkUrl(input?.url);

    const count = await this.socialLinkRepository.count({ where: { userId } });
    if (count >= MAX_SOCIAL_LINKS_PER_USER) {
      throw new BadRequestException('too many social links');
    }

    const link = this.socialLinkRepository.create({
      userId,
      platform,
      url,
    });

    return this.socialLinkRepository.save(link);
  }

  async update(userId: string, id: string, input: UpdateSocialLinkInput): Promise<SocialLink> {
    const existing = await this.findOne(userId, id);

    const platform =
      input?.platform === undefined
        ? existing.platform
        : sanitizePlatform(input.platform);

    const url =
      input?.url === undefined
        ? existing.url
        : sanitizeSocialLinkUrl(input.url);

    existing.platform = platform;
    existing.url = url;

    return this.socialLinkRepository.save(existing);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.socialLinkRepository.delete({ id, userId });
  }
}