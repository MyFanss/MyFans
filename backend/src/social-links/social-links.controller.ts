import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsIn, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Allowed URL schemes for profile social links.
 * Only https is permitted to prevent open redirects and javascript: XSS.
 */
const ALLOWED_SCHEMES = ['https:'] as const;

/**
 * Maximum length for a social link URL.
 */
const MAX_URL_LENGTH = 2048;

/**
 * Payload for creating or updating a social link.
 */
export class SocialLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  platform!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_URL_LENGTH)
  @IsUrl(
    { protocols: ['https'], require_protocol: true, require_tld: true },
    { message: 'url must be a valid https URL' },
  )
  url!: string;
}

/**
 * Validates and sanitizes a social link URL.
 * Rejects javascript:, data:, and any non-https scheme.
 * Throws on invalid input so the controller returns a 400.
 */
export function sanitizeSocialUrl(raw: string): string {
  if (typeof raw !== 'string') {
    throw new Error('url must be a string');
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('url must not be empty');
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new Error(`url must be at most ${MAX_URL_LENGTH} characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('url must be a valid absolute URL');
  }
  if (!ALLOWED_SCHEMES.includes(parsed.protocol as (typeof ALLOWED_SCHEMES)[number])) {
    throw new Error('url scheme must be https');
  }
  return parsed.toString();
}

/**
 * In-memory store for profile social links.
 * Keyed by user id, then platform.
 */
const socialLinksStore = new Map<string, Map<string, string>>();

function getLinks(userId: string): Map<string, string> {
  let links = socialLinksStore.get(userId);
  if (!links) {
    links = new Map<string, string>();
    socialLinksStore.set(userId, links);
  }
  return links;
}

@Controller('users/:userId/social-links')
@UseGuards(ThrottlerGuard)
export class SocialLinksController {
  @Get()
  list(@Param('userId') userId: string) {
    const links = getLinks(userId);
    return Array.from(links.entries()).map(([platform, url]) => ({ platform, url }));
  }

  @Post()
  create(@Param('userId') userId: string, @Body() dto: SocialLinkDto) {
    const url = sanitizeSocialUrl(dto.url);
    getLinks(userId).set(dto.platform, url);
    return { platform: dto.platform, url };
  }

  @Patch(':platform')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  update(
    @Param('userId') userId: string,
    @Param('platform') platform: string,
    @Body() dto: SocialLinkDto,
  ) {
    const url = sanitizeSocialUrl(dto.url);
    getLinks(userId).set(platform, url);
    return { platform, url };
  }

  @Delete(':platform')
  remove(@Param('userId') userId: string, @Param('platform') platform: string) {
    const links = getLinks(userId);
    const existed = links.delete(platform);
    return { platform, deleted: existed };
  }
}
