import { Test, TestingModule } from '@nestjs/testing';
import { SocialLinksService } from './social-links.service';
import { SocialLinksRepository } from './social-links.repository';

describe('SocialLinksService', () => {
  let service: SocialLinksService;
  let repository: jest.Mocked<SocialLinksRepository>;

  beforeEach(async () => {
    repository = {
      findByUser: jest.fn(),
      findByUserAndPlatform: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<SocialLinksRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialLinksService,
        { provide: SocialLinksRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<SocialLinksService>(SocialLinksService);
  });

  it('accepts a valid link for each supported platform', async () => {
    const platforms = service.getSupportedPlatforms();
    expect(platforms.length).toBeGreaterThan(0);

    for (const platform of platforms) {
      const url = `https://example.com/${platform}`;
      repository.upsert.mockResolvedValueOnce({ platform, url });

      const result = await service.upsert('user-1', { platform, url });

      expect(result).toEqual({ platform, url });
      expect(repository.upsert).toHaveBeenCalledWith('user-1', platform, url);
    }
  });

  it('rejects an unsupported platform', async () => {
    await expect(
      service.upsert('user-1', {
        platform: 'not-a-real-platform',
        url: 'https://example.com/x',
      }),
    ).rejects.toThrow(/unsupported platform/i);

    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed URL', async () => {
    const platform = service.getSupportedPlatforms()[0];

    await expect(
      service.upsert('user-1', { platform, url: 'not a url' }),
    ).rejects.toThrow(/url/i);

    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('enforces the per-user link limit with a clear error', async () => {
    const platforms = service.getSupportedPlatforms();
    const limit = service.getMaxLinksPerUser();

    repository.findByUser.mockResolvedValue(
      platforms.slice(0, limit).map((platform) => ({
        platform,
        url: `https://example.com/${platform}`,
      })),
    );

    await expect(
      service.upsert('user-1', {
        platform: platforms[0],
        url: 'https://example.com/extra',
      }),
    ).rejects.toThrow(/limit/i);

    expect(repository.upsert).not.toHaveBeenCalled();
  });
});
