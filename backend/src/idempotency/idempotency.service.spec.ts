import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyKey } from './idempotency-key.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repo: ReturnType<typeof mockRepo>;

  const KEY = 'test-key-123';
  const FP = 'user:abc';
  const METHOD = 'POST';
  const PATH = '/v1/posts';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyKey), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(IdempotencyService);
    repo = module.get(getRepositoryToken(IdempotencyKey));
  });

  describe('acquire()', () => {
    it('returns null for a brand-new key and inserts a record', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({});
      repo.save.mockResolvedValue({});

      const result = await service.acquire(KEY, FP, METHOD, PATH);

      expect(result).toBeNull();
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it('replays cached response for a completed duplicate request', async () => {
      const future = new Date(Date.now() + 60_000);
      repo.findOne.mockResolvedValue({
        key: KEY,
        fingerprint: FP,
        is_complete: true,
        expires_at: future,
        response_status: 201,
        response_body: JSON.stringify({ id: '42' }),
      });

      const result = await service.acquire(KEY, FP, METHOD, PATH);

      expect(result).toEqual({ status: 201, body: { id: '42' } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when first request is still in-flight', async () => {
      const future = new Date(Date.now() + 60_000);
      repo.findOne.mockResolvedValue({
        key: KEY,
        fingerprint: FP,
        is_complete: false,
        expires_at: future,
      });

      await expect(service.acquire(KEY, FP, METHOD, PATH)).rejects.toThrow(
        ConflictException,
      );
    });

    it('removes expired record and creates a fresh one', async () => {
      const past = new Date(Date.now() - 1000);
      repo.findOne.mockResolvedValue({
        key: KEY,
        fingerprint: FP,
        is_complete: true,
        expires_at: past,
      });
      repo.remove.mockResolvedValue(undefined);
      repo.create.mockReturnValue({});
      repo.save.mockResolvedValue({});

      const result = await service.acquire(KEY, FP, METHOD, PATH);

      expect(repo.remove).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('throws ConflictException on unique constraint violation (race condition)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({});
      const pgError = Object.assign(new Error('duplicate key'), { code: '23505' });
      repo.save.mockRejectedValue(pgError);

      await expect(service.acquire(KEY, FP, METHOD, PATH)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unexpected errors from save', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({});
      repo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.acquire(KEY, FP, METHOD, PATH)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });

  describe('complete()', () => {
    it('updates the record with status and body', async () => {
      repo.update.mockResolvedValue({ affected: 1 });

      await service.complete(KEY, FP, 201, { id: '1' });

      expect(repo.update).toHaveBeenCalledWith(
        { key: KEY, fingerprint: FP },
        {
          response_status: 201,
          response_body: JSON.stringify({ id: '1' }),
          is_complete: true,
        },
      );
    });
  });

  describe('release()', () => {
    it('deletes the in-flight record', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.release(KEY, FP);

      expect(repo.delete).toHaveBeenCalledWith({ key: KEY, fingerprint: FP });
    });
  });

  describe('purgeExpired()', () => {
    it('deletes records with expires_at in the past and returns count', async () => {
      repo.delete.mockResolvedValue({ affected: 5 });

      const count = await service.purgeExpired();

      expect(count).toBe(5);
      expect(repo.delete).toHaveBeenCalledTimes(1);
    });

    it('returns 0 when nothing was deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      const count = await service.purgeExpired();

      expect(count).toBe(0);
    });
  });
});
