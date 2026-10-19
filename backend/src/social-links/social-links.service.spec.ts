import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  SocialLinksService,
  MAX_SOCIAL_LINKS_PER_USER,
  MAX_SOCIAL_LINK_URL_LENGTH,
  MAX_SOCIAL_LINK_PLATFORM_LENGTH,
} from './social-links.service';

describe('SocialLinksService', () => {
  let service: SocialLinksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialLinksService],
    }).compile();

    service = module.get<SocialLinksService>(SocialLinksService);
  });

  describe('create', () => {
    it('creates a link and returns it', () => {
      const link = service.create('user-1', {
        platform: 'github',
        url: 'https://github.com/example',
      });

      expect(link).toMatchObject({
        userId: 'user-1',
        platform: 'github',
        url: 'https://github.com/example',
      });
      expect(link.id).toBeDefined();
      expect(link.createdAt).toBeInstanceOf(Date);
      expect(link.updatedAt).toBeInstanceOf(Date);
    });

    it('rejects an empty platform', () => {
      expect(() =>
        service.create('user-1', { platform: '', url: 'https://example.com' }),
      ).toThrow(BadRequestException);
    });

    it('rejects a malformed URL', () => {
      expect(() =>
        service.create('user-1', { platform: 'x', url: 'not-a-url' }),
      ).toThrow(BadRequestException);
    });

    it('rejects a non-https URL', () => {
      expect(() =>
        service.create('user-1', { platform: 'x', url: 'http://example.com' }),
      ).toThrow(BadRequestException);
    });

    it('rejects an overlong URL', () => {
      const longUrl = 'https://x.com/' + 'a'.repeat(MAX_SOCIAL_LINK_URL_LENGTH);
      expect(() =>
        service.create('user-1', { platform: 'x', url: longUrl }),
      ).toThrow(BadRequestException);
    });

    it('rejects an overlong platform', () => {
      const longPlatform = 'a'.repeat(MAX_SOCIAL_LINK_PLATFORM_LENGTH + 1);
      expect(() =>
        service.create('user-1', { platform: longPlatform, url: 'https://example.com' }),
      ).toThrow(BadRequestException);
    });

    describe('per-user cap', () => {
      it(`allows creating exactly ${MAX_SOCIAL_LINKS_PER_USER} links for a user`, () => {
        for (let i = 0; i < MAX_SOCIAL_LINKS_PER_USER; i++) {
          const link = service.create('user-cap', {
            platform: `platform-${i}`,
            url: `https://example.com/${i}`,
          });
          expect(link).toBeDefined();
        }
      });

      it(`throws BadRequestException when exceeding ${MAX_SOCIAL_LINKS_PER_USER} links`, () => {
        // Create up to the cap
        for (let i = 0; i < MAX_SOCIAL_LINKS_PER_USER; i++) {
          service.create('user-over', {
            platform: `platform-${i}`,
            url: `https://example.com/${i}`,
          });
        }

        // The N+1th create should throw
        expect(() =>
          service.create('user-over', {
            platform: 'extra',
            url: 'https://example.com/extra',
          }),
        ).toThrow(BadRequestException);

        expect(() =>
          service.create('user-over', {
            platform: 'extra',
            url: 'https://example.com/extra',
          }),
        ).toThrow('too many social links');
      });

      it('allows a different user to create links independently of the cap on the first user', () => {
        for (let i = 0; i < MAX_SOCIAL_LINKS_PER_USER; i++) {
          service.create('user-a', {
            platform: `platform-${i}`,
            url: `https://example.com/${i}`,
          });
        }

        // Second user should still be able to create links
        const link = service.create('user-b', {
          platform: 'github',
          url: 'https://github.com/example',
        });
        expect(link).toBeDefined();
      });
    });
  });

  describe('list', () => {
    it('returns an empty array when the user has no links', () => {
      expect(service.list('no-links')).toEqual([]);
    });

    it('returns only the links belonging to the requested user', () => {
      service.create('user-a', {
        platform: 'a1',
        url: 'https://a1.example.com',
      });
      service.create('user-b', {
        platform: 'b1',
        url: 'https://b1.example.com',
      });
      service.create('user-a', {
        platform: 'a2',
        url: 'https://a2.example.com',
      });

      const linksA = service.list('user-a');
      expect(linksA).toHaveLength(2);
      expect(linksA.every((l) => l.userId === 'user-a')).toBe(true);

      const linksB = service.list('user-b');
      expect(linksB).toHaveLength(1);
      expect(linksB[0].userId).toBe('user-b');
    });
  });

  describe('findOne', () => {
    it('returns the link by id', () => {
      const created = service.create('user-1', {
        platform: 'github',
        url: 'https://github.com/example',
      });
      const found = service.findOne('user-1', created.id);
      expect(found).toEqual(created);
    });

    it('throws NotFoundException for a non-existent id', () => {
      expect(() => service.findOne('user-1', 'nonexistent')).toThrow(/not found/i);
    });

    it('throws NotFoundException when the link belongs to another user', () => {
      const created = service.create('user-a', {
        platform: 'github',
        url: 'https://github.com/example',
      });
      expect(() => service.findOne('user-b', created.id)).toThrow(/not found/i);
    });
  });

  describe('update', () => {
    it('updates the platform and url of an existing link', () => {
      const created = service.create('user-1', {
        platform: 'github',
        url: 'https://github.com/example',
      });

      const updated = service.update('user-1', created.id, {
        platform: 'twitter',
        url: 'https://twitter.com/example',
      });

      expect(updated.platform).toBe('twitter');
      expect(updated.url).toBe('https://twitter.com/example');
      expect(updated.createdAt).toEqual(created.createdAt);
    });

    it('is unaffected by the per-user cap (update does not check count)', () => {
      // Fill the cap
      for (let i = 0; i < MAX_SOCIAL_LINKS_PER_USER; i++) {
        service.create('user-upd', {
          platform: `platform-${i}`,
          url: `https://example.com/${i}`,
        });
      }

      // update the first link — should succeed even though cap is reached
      const links = service.list('user-upd');
      const firstId = links[0].id;
      const updated = service.update('user-upd', firstId, {
        url: 'https://updated.example.com',
      });
      expect(updated.url).toBe('https://updated.example.com');
    });

    it('throws when the link does not exist', () => {
      expect(() =>
        service.update('user-1', 'nonexistent', { platform: 'x' }),
      ).toThrow(/not found/i);
    });
  });

  describe('remove', () => {
    it('removes an existing link', () => {
      const created = service.create('user-1', {
        platform: 'github',
        url: 'https://github.com/example',
      });

      service.remove('user-1', created.id);
      expect(service.list('user-1')).toHaveLength(0);
    });

    it('is unaffected by the per-user cap', () => {
      for (let i = 0; i < MAX_SOCIAL_LINKS_PER_USER; i++) {
        service.create('user-rm', {
          platform: `platform-${i}`,
          url: `https://example.com/${i}`,
        });
      }

      const links = service.list('user-rm');
      expect(links).toHaveLength(MAX_SOCIAL_LINKS_PER_USER);

      service.remove('user-rm', links[0].id);
      expect(service.list('user-rm')).toHaveLength(MAX_SOCIAL_LINKS_PER_USER - 1);

      // After removal we should be able to create again
      const newLink = service.create('user-rm', {
        platform: 'new',
        url: 'https://new.example.com',
      });
      expect(newLink).toBeDefined();
    });

    it('throws when the link does not exist', () => {
      expect(() => service.remove('user-1', 'nonexistent')).toThrow(/not found/i);
    });
  });
});