import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { SocialLinksDto } from './social-links.dto';
import { SocialLinksService } from './social-links.service';
import { SocialLinksResponseDto } from './user-profile.dto';

describe('SocialLinksService', () => {
  let service: SocialLinksService;

  beforeEach(() => {
    service = new SocialLinksService();
  });

  // ─── validateDomainAllowlist ─────────────────────────────────────────────────

  describe('validateDomainAllowlist', () => {
    it('accepts websiteUrl on twitter.com', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://twitter.com/johndoe',
        }),
      ).not.toThrow();
    });

    it('accepts websiteUrl on instagram.com', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://instagram.com/johndoe',
        }),
      ).not.toThrow();
    });

    it('accepts websiteUrl on linkedin.com', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://linkedin.com/in/johndoe',
        }),
      ).not.toThrow();
    });

    it('accepts websiteUrl on www.twitter.com (subdomain)', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://www.twitter.com/johndoe',
        }),
      ).not.toThrow();
    });

    it('accepts websiteUrl with http scheme on allowed domain', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'http://twitter.com/johndoe',
        }),
      ).not.toThrow();
    });

    it('accepts websiteUrl with trailing slash on allowed domain', () => {
      expect(() =>
        service.validateDomainAllowlist({ websiteUrl: 'https://twitter.com/' }),
      ).not.toThrow();
    });

    it('accepts otherLink on allowed domain', () => {
      expect(() =>
        service.validateDomainAllowlist({
          otherLink: 'https://instagram.com/mypage',
        }),
      ).not.toThrow();
    });

    it('accepts null/undefined/empty (optional fields)', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: null,
          otherLink: undefined,
        }),
      ).not.toThrow();
      expect(() =>
        service.validateDomainAllowlist({ websiteUrl: '' }),
      ).not.toThrow();
    });

    it('skips handle fields (twitterHandle, instagramHandle)', () => {
      expect(() =>
        service.validateDomainAllowlist({
          twitterHandle: 'johndoe',
          instagramHandle: 'johndoe',
        }),
      ).not.toThrow();
    });

    it('rejects websiteUrl on disallowed domain', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://evil.com/phish',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects websiteUrl on disallowed domain with user-friendly message', () => {
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://evil.com/phish',
        }),
      ).toThrow(/website_url domain "evil.com" is not allowed/);
    });

    it('rejects otherLink on disallowed domain', () => {
      expect(() =>
        service.validateDomainAllowlist({
          otherLink: 'https://malware.org/script',
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects invalid URL format', () => {
      expect(() =>
        service.validateDomainAllowlist({ websiteUrl: 'not-a-url' }),
      ).toThrow(BadRequestException);
    });

    it('rejects domain that merely contains an allowed domain as substring', () => {
      // "nottwitter.com" should NOT match "twitter.com"
      expect(() =>
        service.validateDomainAllowlist({
          websiteUrl: 'https://nottwitter.com/page',
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ─── extractUpdatePayload ─────────────────────────────────────────────────

  describe('extractUpdatePayload', () => {
    it('happy path: creates and stores normalized social links', () => {
      const dto = plainToInstance(SocialLinksDto, {
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: '@JohnDoe',
        instagramHandle: '@PhotoFan',
        otherLink: 'https://linkedin.com/in/johndoe',
      });
      const payload = service.createSocialLinks(dto);

      expect(payload).toEqual({
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
        instagramHandle: 'photofan',
        otherLink: 'https://linkedin.com/in/johndoe',
      });

      const list = service.listSocialLinks({ page: 1, limit: 10 });
      expect(list.data).toHaveLength(1);
      expect(list.data[0]).toMatchObject({
        id: '1',
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
        instagramHandle: 'photofan',
        otherLink: 'https://linkedin.com/in/johndoe',
      });
    });

    it('happy path: updates an existing stored record by id', () => {
      service.createSocialLinks({
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
      });

      const payload = service.updateSocialLinks('1', {
        instagramHandle: 'creatorlife',
        otherLink: 'https://linkedin.com/in/johndoe',
      });

      expect(payload).toEqual({
        instagramHandle: 'creatorlife',
        otherLink: 'https://linkedin.com/in/johndoe',
      });
      expect(
        service.listSocialLinks({ page: 1, limit: 10 }).data[0],
      ).toMatchObject({
        id: '1',
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
        instagramHandle: 'creatorlife',
        otherLink: 'https://linkedin.com/in/johndoe',
      });
    });

    it('extracts all provided social link fields on allowed domains', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
        instagramHandle: 'johndoe',
        otherLink: 'https://linkedin.com/in/johndoe',
      });

      expect(payload).toEqual({
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
        instagramHandle: 'johndoe',
        otherLink: 'https://linkedin.com/in/johndoe',
      });
    });

    it('maps undefined values to null', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: undefined,
        twitterHandle: undefined,
      });

      expect(payload.websiteUrl).toBeNull();
      expect(payload.twitterHandle).toBeNull();
    });

    it('does not include keys not present in the dto', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: 'https://twitter.com/page',
        // twitterHandle, instagramHandle, otherLink not passed
      });

      expect(Object.keys(payload)).toEqual(['websiteUrl']);
    });

    it('preserves explicit null values', () => {
      const payload = service.extractUpdatePayload({
        websiteUrl: null,
        twitterHandle: null,
      });

      expect(payload.websiteUrl).toBeNull();
      expect(payload.twitterHandle).toBeNull();
    });

    it('throws when websiteUrl domain is disallowed', () => {
      expect(() =>
        service.extractUpdatePayload({ websiteUrl: 'https://evil.com' }),
      ).toThrow(BadRequestException);
    });

    it('throws when otherLink domain is disallowed', () => {
      expect(() =>
        service.extractUpdatePayload({
          otherLink: 'https://bad-site.org/page',
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ─── toResponseDto ────────────────────────────────────────────────────────

  describe('toResponseDto', () => {
    it('maps all fields from entity', () => {
      const entity = {
        websiteUrl: 'https://twitter.com/johndoe',
        twitterHandle: 'johndoe',
        instagramHandle: 'johndoe',
        otherLink: 'https://linkedin.com/in/johndoe',
      };

      const dto: SocialLinksResponseDto = service.toResponseDto(entity);

      expect(dto.websiteUrl).toBe('https://twitter.com/johndoe');
      expect(dto.twitterHandle).toBe('johndoe');
      expect(dto.instagramHandle).toBe('johndoe');
      expect(dto.otherLink).toBe('https://linkedin.com/in/johndoe');
    });

    it('returns null for missing entity fields', () => {
      const dto = service.toResponseDto({});

      expect(dto.websiteUrl).toBeNull();
      expect(dto.twitterHandle).toBeNull();
      expect(dto.instagramHandle).toBeNull();
      expect(dto.otherLink).toBeNull();
    });

    it('returns null when entity fields are explicitly null', () => {
      const dto = service.toResponseDto({
        websiteUrl: null,
        twitterHandle: null,
        instagramHandle: null,
        otherLink: null,
      });

      expect(dto.websiteUrl).toBeNull();
      expect(dto.twitterHandle).toBeNull();
      expect(dto.instagramHandle).toBeNull();
      expect(dto.otherLink).toBeNull();
    });
  });

  // ─── listSocialLinks ──────────────────────────────────────────────────────

  describe('listSocialLinks', () => {
    beforeEach(() => {
      service.createSocialLinks({ twitterHandle: 'first' });
      service.createSocialLinks({ twitterHandle: 'second' });
      service.createSocialLinks({ twitterHandle: 'third' });
    });

    it('returns a page-paginated social links response', () => {
      const page = service.listSocialLinks({ page: 2, limit: 1 });

      expect(page).toMatchObject({
        total: 3,
        page: 2,
        limit: 1,
        totalPages: 3,
        hasMore: true,
      });
      expect(page.data).toEqual([
        {
          id: '2',
          websiteUrl: null,
          twitterHandle: 'second',
          instagramHandle: null,
          otherLink: null,
        },
      ]);
    });

    it('uses safe defaults for invalid direct service pagination input', () => {
      const page = service.listSocialLinks({ page: 0, limit: -1 });

      expect(page.page).toBe(1);
      expect(page.limit).toBe(20);
      expect(page.data).toHaveLength(3);
    });

    it('caps direct service limit input at 100', () => {
      const page = service.listSocialLinks({ page: 1, limit: 500 });

      expect(page.limit).toBe(100);
    });
  });
});
