import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdempotencyService } from '../idempotency.service';
import { IdempotencyKey } from '../idempotency-key.entity';

function makeMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: Partial<IdempotencyKey>) => data),
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(async () => {
    repo = makeMockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyKey), useValue: repo },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  describe('acquire', () => {
    it('returns null for a new key (first-time request)', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.acquire('key-1', 'fp-1', 'POST', '/v1/posts');

      expect(result).toBeNull();
      expect(repo.save).toHaveBeenCalled();
    });

    it('returns cached response for a completed key', async () => {
      repo.findOne.mockResolvedValue({
        key: 'key-1',
        fingerprint: 'fp-1',
        method: 'POST',
        path: '/v1/posts',
        is_complete: true,
        response_status: 201,
        response_body: JSON.stringify({ id: 'abc' }),
        expires_at: new Date(Date.now() + 60_000),
      });

      const result = await service.acquire('key-1', 'fp-1', 'POST', '/v1/posts');

      expect(result).toEqual({ status: 201, body: { id: 'abc' } });
    });

    it('throws 409 when same key is used with different fingerprint (body mismatch)', async () => {
      repo.findOne.mockResolvedValue({
        key: 'key-1',
        fingerprint: 'user:1|hash-aaa',
        method: 'POST',
        path: '/v1/posts',
        is_complete: true,
        response_status: 201,
        response_body: JSON.stringify({ id: 'abc' }),
        expires_at: new Date(Date.now() + 60_000),
      });

      await expect(
        service.acquire('key-1', 'user:1|hash-bbb', 'POST', '/v1/posts'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 409 when first request is still in-flight', async () => {
      repo.findOne.mockResolvedValue({
        key: 'key-1',
        fingerprint: 'fp-1',
        method: 'POST',
        path: '/v1/posts',
        is_complete: false,
        expires_at: new Date(Date.now() + 60_000),
      });

      await expect(
        service.acquire('key-1', 'fp-1', 'POST', '/v1/posts'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 422 when key is reused for different endpoint', async () => {
      repo.findOne.mockResolvedValue({
        key: 'key-1',
        fingerprint: 'fp-1',
        method: 'POST',
        path: '/v1/posts',
        is_complete: true,
        response_status: 201,
        response_body: '{}',
        expires_at: new Date(Date.now() + 60_000),
      });

      await expect(
        service.acquire('key-1', 'fp-1', 'PUT', '/v1/posts/123'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('removes expired record and allows re-use', async () => {
      repo.findOne.mockResolvedValue({
        key: 'key-1',
        fingerprint: 'fp-1',
        method: 'POST',
        path: '/v1/posts',
        is_complete: true,
        expires_at: new Date(Date.now() - 1000), // expired
      });

      const result = await service.acquire('key-1', 'fp-1', 'POST', '/v1/posts');

      expect(repo.remove).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('complete', () => {
    it('updates the record with response status and body', async () => {
      await service.complete('key-1', 'fp-1', 201, { id: 'abc' });

      expect(repo.update).toHaveBeenCalledWith(
        { key: 'key-1', fingerprint: 'fp-1' },
        {
          response_status: 201,
          response_body: JSON.stringify({ id: 'abc' }),
          is_complete: true,
        },
      );
    });
  });

  describe('release', () => {
    it('deletes the in-flight record', async () => {
      await service.release('key-1', 'fp-1');

      expect(repo.delete).toHaveBeenCalledWith({ key: 'key-1', fingerprint: 'fp-1' });
    });
  });

  describe('purgeExpired', () => {
    it('deletes expired records in batches', async () => {
      const expiredBatch = [{ id: '1' }, { id: '2' }, { id: '3' }];
      repo.find.mockResolvedValueOnce(expiredBatch).mockResolvedValueOnce([]);
      repo.delete.mockResolvedValueOnce({ affected: 3 });

      const count = await service.purgeExpired(100);

      expect(count).toBe(3);
      expect(repo.delete).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('returns 0 when no expired records exist', async () => {
      repo.find.mockResolvedValue([]);

      const count = await service.purgeExpired();

      expect(count).toBe(0);
    });
  });
});
