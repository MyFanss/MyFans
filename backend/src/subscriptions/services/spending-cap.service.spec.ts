import { BadRequestException } from '@nestjs/common';
import { SpendingCapService } from './spending-cap.service';
import { CapPeriod } from '../entities/fan-spending-cap.entity';

const FAN = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function makeRepo(initial: any = null) {
  let stored: any = initial;
  return {
    findOne: jest.fn(async () => stored),
    create: jest.fn((data: any) => ({ ...data, updatedAt: new Date() })),
    save: jest.fn(async (entity: any) => {
      stored = { ...entity, updatedAt: new Date() };
      return stored;
    }),
    delete: jest.fn(async () => { stored = null; }),
  };
}

function makeService(repo: any) {
  return new (SpendingCapService as any)(repo) as SpendingCapService;
}

describe('SpendingCapService', () => {
  it('returns null when no cap is set', async () => {
    const svc = makeService(makeRepo(null));
    expect(await svc.getCap(FAN)).toBeNull();
  });

  it('creates a new cap', async () => {
    const repo = makeRepo(null);
    const svc = makeService(repo);
    const result = await svc.setCap(FAN, { capAmount: 1000, period: CapPeriod.MONTHLY });
    expect(result.capAmount).toBe('1000');
    expect(result.spentAmount).toBe('0');
  });

  it('assertWithinCap passes when no cap exists', async () => {
    const svc = makeService(makeRepo(null));
    await expect(svc.assertWithinCap(FAN, BigInt(9999))).resolves.toBeUndefined();
  });

  it('assertWithinCap passes when under the limit', async () => {
    const cap = {
      fanAddress: FAN,
      capAmount: BigInt(1000),
      period: CapPeriod.MONTHLY,
      spentAmount: BigInt(500),
      periodStartedAt: new Date(),
      updatedAt: new Date(),
    };
    const svc = makeService(makeRepo(cap));
    await expect(svc.assertWithinCap(FAN, BigInt(499))).resolves.toBeUndefined();
  });

  it('assertWithinCap throws when over the limit', async () => {
    const cap = {
      fanAddress: FAN,
      capAmount: BigInt(1000),
      period: CapPeriod.MONTHLY,
      spentAmount: BigInt(900),
      periodStartedAt: new Date(),
      updatedAt: new Date(),
    };
    const svc = makeService(makeRepo(cap));
    await expect(svc.assertWithinCap(FAN, BigInt(200))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recordSpend accumulates spend', async () => {
    const cap = {
      fanAddress: FAN,
      capAmount: BigInt(1000),
      period: CapPeriod.MONTHLY,
      spentAmount: BigInt(100),
      periodStartedAt: new Date(),
      updatedAt: new Date(),
    };
    const repo = makeRepo(cap);
    const svc = makeService(repo);
    await svc.recordSpend(FAN, BigInt(200));
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ spentAmount: BigInt(300) }),
    );
  });

  it('resets period spend when period has elapsed', async () => {
    const oldStart = new Date(Date.now() - 31 * 24 * 3600 * 1000); // 31 days ago
    const cap = {
      fanAddress: FAN,
      capAmount: BigInt(1000),
      period: CapPeriod.MONTHLY,
      spentAmount: BigInt(999),
      periodStartedAt: oldStart,
      updatedAt: new Date(),
    };
    const repo = makeRepo(cap);
    const svc = makeService(repo);
    // Should not throw — period reset clears spentAmount
    await expect(svc.assertWithinCap(FAN, BigInt(999))).resolves.toBeUndefined();
  });

  it('removeCap deletes the record', async () => {
    const repo = makeRepo({ fanAddress: FAN });
    const svc = makeService(repo);
    await svc.removeCap(FAN);
    expect(repo.delete).toHaveBeenCalledWith({ fanAddress: FAN });
  });
});
