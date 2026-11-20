import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SocialLink } from './entities/social-link.entity';
import {
  SocialLinksService,
  MAX_SOCIAL_LINKS_PER_USER,
  MAX_SOCIAL_LINK_URL_LENGTH,
  MAX_SOCIAL_LINK_PLATFORM_LENGTH,
  sanitizeSocialLinkUrl,
} from './social-links.service';

describe('sanitizeSocialLinkUrl', () => {
  it('rejects a javascript: scheme', () => {
    expect(() => sanitizeSocialLinkUrl('javascript:alert(1)')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a data: scheme', () => {
    expect(() =>
      sanitizeSocialLinkUrl('data:text/html,<script>alert(1)</script>'),
    ).toThrow(BadRequestException);
  });

  it('rejects an http: scheme', () => {
    expect(() => sanitizeSocialLinkUrl('http://example.com')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a malformed URL', () => {
    expect(() => sanitizeSocialLinkUrl('not a url')).toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty string', () => {
    expect(() => sanitizeSocialLinkUrl('')).toThrow(BadRequestException);
  });

  it('rejects a whitespace-only string', () => {
    expect(() => sanitizeSocialLinkUrl('   ')).toThrow(BadRequestException);
  });

  it('rejects a URL longer than the maximum length', () => {
    const longUrl = 'https://x.com/' + 'a'.repeat(MAX_SOCIAL_LINK_URL_LENGTH);
    expect(() => sanitizeSocialLinkUrl(longUrl)).toThrow(BadRequestException);
  });

  it('rejects a URL with no hostname', () => {
    expect(() => sanitizeSocialLinkUrl('https:///path')).toThrow(
      BadRequestException,
    );
  });

  it('normalizes a valid https URL (trims and parses)', () => {
    const result = sanitizeSocialLinkUrl('  https://example.com/path  ');
    expect(result).toBe('https://example.com/path');
  });

  it('accepts a valid https URL and returns a string starting with https://', () => {
    expect(sanitizeSocialLinkUrl('https://example.com/a')).toMatch(
      /^https:\/\//,
    );
  });
});

describe('SocialLinksService', () => {
  let service: SocialLinksService;

  const socialLinkRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const makeLink = (overrides: Partial<SocialLink> = {}): SocialLink =>
    ({
      id: 'link-1',
      userId: 'user-1',
      platform: 'github',
      url: 'https://github.com/example',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides,
    }) as SocialLink;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialLinksService,
        {
          provide: getRepositoryToken(SocialLink),
          useValue: socialLinkRepository,
        },
      ],
    }).compile();

    service = module.get<SocialLinksService>(SocialLinksService);
  });

  describe('create', () => {
    it('creates a link and returns it', async () => {
      const saved = makeLink();
      socialLinkRepository.count.mockResolvedValue(0);
      socialLinkRepository.create.mockReturnValue({
        userId: 'user-1',
        platform: 'github',
        url: 'https://github.com/example',
      });
      socialLinkRepository.save.mockResolvedValue(saved);

      const link = await service.create('user-1', {
        platform: 'github',
        url: 'https://github.com/example',
      });

      expect(socialLinkRepository.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(socialLinkRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        platform: 'github',
        url: 'https://github.com/example',
      });
      expect(socialLinkRepository.save).toHaveBeenCalledTimes(1);
      expect(link).toEqual(saved);
    });

    it('rejects an empty platform', async () => {
      await expect(
        service.create('user-1', { platform: '', url: 'https://example.com' }),
      ).rejects.toThrow(BadRequestException);

      expect(socialLinkRepository.count).not.toHaveBeenCalled();
      expect(socialLinkRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a malformed URL', async () => {
      await expect(
        service.create('user-1', { platform: 'x', url: 'not-a-url' }),
      ).rejects.toThrow(BadRequestException);

      expect(socialLinkRepository.count).not.toHaveBeenCalled();
    });

    it('rejects a non-https URL', async () => {
      await expect(
        service.create('user-1', { platform: 'x', url: 'http://example.com' }),
      ).rejects.toThrow(BadRequestException);

      expect(socialLinkRepository.count).not.toHaveBeenCalled();
    });

    it('rejects an overlong URL', async () => {
      const longUrl = 'https://x.com/' + 'a'.repeat(MAX_SOCIAL_LINK_URL_LENGTH);
      await expect(
        service.create('user-1', { platform: 'x', url: longUrl }),
      ).rejects.toThrow(BadRequestException);

      expect(socialLinkRepository.count).not.toHaveBeenCalled();
    });

    it('rejects an overlong platform', async () => {
      const longPlatform = 'a'.repeat(MAX_SOCIAL_LINK_PLATFORM_LENGTH + 1);
      await expect(
        service.create('user-1', {
          platform: longPlatform,
          url: 'https://example.com',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(socialLinkRepository.count).not.toHaveBeenCalled();
    });

    describe('per-user cap', () => {
      it(`rejects the create when the user already has ${MAX_SOCIAL_LINKS_PER_USER} links`, async () => {
        socialLinkRepository.count.mockResolvedValue(MAX_SOCIAL_LINKS_PER_USER);

        await expect(
          service.create('user-1', {
            platform: 'github',
            url: 'https://github.com/example',
          }),
        ).rejects.toThrow('too many social links');

        expect(socialLinkRepository.count).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
        });
        expect(socialLinkRepository.save).not.toHaveBeenCalled();
      });

      it(`does not reject because of the cap when the user has ${MAX_SOCIAL_LINKS_PER_USER - 1} links`, async () => {
        const saved = makeLink();
        socialLinkRepository.count.mockResolvedValue(
          MAX_SOCIAL_LINKS_PER_USER - 1,
        );
        socialLinkRepository.create.mockReturnValue({
          userId: 'user-1',
          platform: 'github',
          url: 'https://github.com/example',
        });
        socialLinkRepository.save.mockResolvedValue(saved);

        const link = await service.create('user-1', {
          platform: 'github',
          url: 'https://github.com/example',
        });

        expect(socialLinkRepository.count).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
        });
        expect(socialLinkRepository.save).toHaveBeenCalledTimes(1);
        expect(link).toEqual(saved);
      });
    });
  });

  describe('list', () => {
    it('returns an empty array when the user has no links', async () => {
      socialLinkRepository.find.mockResolvedValue([]);

      const links = await service.list('no-links');

      expect(links).toEqual([]);
      expect(socialLinkRepository.find).toHaveBeenCalledWith({
        where: { userId: 'no-links' },
        order: { createdAt: 'ASC' },
      });
    });

    it('returns only the links belonging to the requested user', async () => {
      socialLinkRepository.find.mockResolvedValue([
        makeLink({ id: 'link-a', userId: 'user-a' }),
        makeLink({ id: 'link-b', userId: 'user-a' }),
      ]);

      const links = await service.list('user-a');

      expect(links).toHaveLength(2);
      expect(socialLinkRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-a' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the link by id', async () => {
      const link = makeLink();
      socialLinkRepository.findOne.mockResolvedValue(link);

      const found = await service.findOne('user-1', 'link-1');

      expect(found).toEqual(link);
      expect(socialLinkRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'link-1', userId: 'user-1' },
      });
    });

    it('throws NotFoundException for a non-existent id', async () => {
      socialLinkRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the link belongs to another user', async () => {
      socialLinkRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('user-b', 'link-a')).rejects.toThrow(
        NotFoundException,
      );

      expect(socialLinkRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'link-a', userId: 'user-b' },
      });
    });
  });

  describe('update', () => {
    it('updates the platform and url of an existing link', async () => {
      const existing = makeLink();
      const updated = makeLink({
        platform: 'twitter',
        url: 'https://twitter.com/example',
      });
      socialLinkRepository.findOne.mockResolvedValue(existing);
      socialLinkRepository.save.mockResolvedValue(updated);

      const result = await service.update('user-1', 'link-1', {
        platform: 'twitter',
        url: 'https://twitter.com/example',
      });

      expect(result).toEqual(updated);
      expect(socialLinkRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'twitter',
          url: 'https://twitter.com/example',
        }),
      );
    });

    it('is unaffected by the per-user cap (update does not check count)', async () => {
      const existing = makeLink();
      socialLinkRepository.findOne.mockResolvedValue(existing);
      socialLinkRepository.save.mockResolvedValue(
        makeLink({ url: 'https://updated.example.com' }),
      );

      const result = await service.update('user-1', 'link-1', {
        url: 'https://updated.example.com',
      });

      expect(result.url).toBe('https://updated.example.com');
      expect(socialLinkRepository.count).not.toHaveBeenCalled();
    });

    it('throws when the link does not exist', async () => {
      socialLinkRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'nonexistent', { platform: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when a different user tries to update the link and leaves it unchanged', async () => {
      socialLinkRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('user-other', 'link-1', { platform: 'hacked' }),
      ).rejects.toThrow(NotFoundException);

      expect(socialLinkRepository.save).not.toHaveBeenCalled();
    });

    it('omitted platform or url keeps the previous value', async () => {
      const existing = makeLink();
      socialLinkRepository.findOne.mockResolvedValue(existing);
      socialLinkRepository.save.mockImplementation(async (entity) => entity);

      const updated = await service.update('user-1', 'link-1', {
        platform: 'twitter',
      });

      expect(updated.platform).toBe('twitter');
      expect(updated.url).toBe('https://github.com/example');

      const updatedAgain = await service.update('user-1', 'link-1', {
        url: 'https://twitter.com/new-example',
      });

      expect(updatedAgain.platform).toBe('twitter');
      expect(updatedAgain.url).toBe('https://twitter.com/new-example');
    });
  });

  describe('remove', () => {
    it('removes an existing link', async () => {
      socialLinkRepository.findOne.mockResolvedValue(makeLink());
      socialLinkRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('user-1', 'link-1');

      expect(socialLinkRepository.delete).toHaveBeenCalledWith({
        id: 'link-1',
        userId: 'user-1',
      });
    });

    it('is unaffected by the per-user cap', async () => {
      socialLinkRepository.findOne.mockResolvedValue(makeLink());
      socialLinkRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('user-1', 'link-1');

      expect(socialLinkRepository.count).not.toHaveBeenCalled();
    });

    it('throws when the link does not exist', async () => {
      socialLinkRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when a different user tries to remove the link and leaves it in place', async () => {
      socialLinkRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('user-other', 'link-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(socialLinkRepository.delete).not.toHaveBeenCalled();
    });
  });
});
