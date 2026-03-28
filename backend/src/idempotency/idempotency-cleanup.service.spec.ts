import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyCleanupService', () => {
  let cleanupService: IdempotencyCleanupService;
  let idempotencyService: { purgeExpired: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyCleanupService,
        {
          provide: IdempotencyService,
          useValue: { purgeExpired: jest.fn() },
        },
      ],
    }).compile();

    cleanupService = module.get(IdempotencyCleanupService);
    idempotencyService = module.get(IdempotencyService);
  });

  it('should be defined', () => {
    expect(cleanupService).toBeDefined();
  });

  it('calls purgeExpired() when the cron fires', async () => {
    idempotencyService.purgeExpired.mockResolvedValue(3);

    await cleanupService.handleCron();

    expect(idempotencyService.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('handles purgeExpired() returning 0 without error', async () => {
    idempotencyService.purgeExpired.mockResolvedValue(0);

    await expect(cleanupService.handleCron()).resolves.not.toThrow();
  });
});
