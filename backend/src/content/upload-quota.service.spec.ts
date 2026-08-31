import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MAX_UPLOADS_PER_CREATOR_PER_HOUR } from '../common/constants/body-upload-quotas';
import { ContentUploadEvent } from './entities/content-upload-event.entity';
import { UploadQuotaService } from './upload-quota.service';

describe('UploadQuotaService', () => {
  let service: UploadQuotaService;
  const repo = {
    count: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadQuotaService,
        { provide: getRepositoryToken(ContentUploadEvent), useValue: repo },
      ],
    }).compile();
    service = module.get(UploadQuotaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('allows an upload when under the hourly limit', async () => {
    repo.count.mockResolvedValue(MAX_UPLOADS_PER_CREATOR_PER_HOUR - 1);
    await expect(
      service.assertWithinQuota('creator-1'),
    ).resolves.toBeUndefined();
  });

  it('throws 429 once the hourly limit is reached', async () => {
    repo.count.mockResolvedValue(MAX_UPLOADS_PER_CREATOR_PER_HOUR);
    await expect(service.assertWithinQuota('creator-1')).rejects.toMatchObject({
      // HttpException with a 429 status
      status: 429,
    } as Partial<HttpException>);
  });

  it('records an upload against the creator', async () => {
    await service.record('creator-1');
    expect(repo.insert).toHaveBeenCalledWith({ creator_id: 'creator-1' });
  });

  it('purges stale rows and reports the count', async () => {
    repo.delete.mockResolvedValue({ affected: 3 });
    await expect(service.purgeExpired()).resolves.toBe(3);
  });
});
