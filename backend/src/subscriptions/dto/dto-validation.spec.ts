import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListSubscriptionsQueryDto } from './list-subscriptions-query.dto';
import { ListCreatorSubscribersQueryDto } from './list-creator-subscribers-query.dto';
import { SubscriptionStateQueryDto } from './subscription-state-query.dto';
import { SubscriptionIndexerEventDto } from './subscription-indexer-event.dto';
import { SetSpendingCapDto } from './spending-cap.dto';
import { FanDashboardQueryDto } from './fan-dashboard-query.dto';

describe('ListSubscriptionsQueryDto – invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(ListSubscriptionsQueryDto, plain);
    return validate(dto);
  }

  it('fails when fan is empty string', async () => {
    const errors = await validateDto({ fan: '' });
    expect(errors.some((e) => e.property === 'fan')).toBe(true);
  });

  it('fails when fan is missing', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'fan')).toBe(true);
  });

  it('fails when status is an invalid string', async () => {
    const errors = await validateDto({ fan: 'GFAN', status: 'bogus' });
    const statusErrors = errors.filter((e) => e.property === 'status');
    expect(statusErrors).toHaveLength(1);
  });

  it('fails when sort is an invalid string', async () => {
    const errors = await validateDto({ fan: 'GFAN', sort: 'alphabetical' });
    const sortErrors = errors.filter((e) => e.property === 'sort');
    expect(sortErrors).toHaveLength(1);
  });

  it('fails when limit is zero', async () => {
    const errors = await validateDto({ fan: 'GFAN', limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails when limit is negative', async () => {
    const errors = await validateDto({ fan: 'GFAN', limit: -5 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails when limit exceeds maximum', async () => {
    const errors = await validateDto({ fan: 'GFAN', limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails when page is zero', async () => {
    const errors = await validateDto({ fan: 'GFAN', page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('fails when page is negative', async () => {
    const errors = await validateDto({ fan: 'GFAN', page: -1 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});

describe('ListCreatorSubscribersQueryDto – invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(ListCreatorSubscribersQueryDto, plain);
    return validate(dto);
  }

  it('fails when creator is missing', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'creator')).toBe(true);
  });

  it('fails when creator is empty string', async () => {
    const errors = await validateDto({ creator: '' });
    expect(errors.some((e) => e.property === 'creator')).toBe(true);
  });

  it('fails when status is not active or expired', async () => {
    const errors = await validateDto({
      creator: 'GCREATOR',
      status: 'pending',
    });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('fails when sort is invalid', async () => {
    const errors = await validateDto({ creator: 'GCREATOR', sort: 'price' });
    expect(errors.some((e) => e.property === 'sort')).toBe(true);
  });

  it('fails when limit exceeds maximum', async () => {
    const errors = await validateDto({ creator: 'GCREATOR', limit: 200 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails when limit is zero', async () => {
    const errors = await validateDto({ creator: 'GCREATOR', limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});

describe('SubscriptionStateQueryDto – invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(SubscriptionStateQueryDto, plain);
    return validate(dto);
  }

  it('fails when creator is missing', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'creator')).toBe(true);
  });

  it('fails when creator is empty string', async () => {
    const errors = await validateDto({ creator: '' });
    expect(errors.some((e) => e.property === 'creator')).toBe(true);
  });

  it('fails when creator does not match G-address format', async () => {
    const errors = await validateDto({ creator: 'not-a-stellar-address' });
    const creatorErrors = errors.filter((e) => e.property === 'creator');
    expect(creatorErrors.length).toBeGreaterThan(0);
  });

  it('fails when creator is lowercase g-address', async () => {
    const errors = await validateDto({ creator: 'g' + 'A'.repeat(55) });
    const creatorErrors = errors.filter((e) => e.property === 'creator');
    expect(creatorErrors.length).toBeGreaterThan(0);
  });

  it('fails when creator is too short', async () => {
    const errors = await validateDto({ creator: 'GABCDEF' });
    const creatorErrors = errors.filter((e) => e.property === 'creator');
    expect(creatorErrors.length).toBeGreaterThan(0);
  });
});

describe('SubscriptionIndexerEventDto – invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(SubscriptionIndexerEventDto, plain);
    return validate(dto);
  }

  it('fails when event is missing', async () => {
    const errors = await validateDto({
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 1,
    });
    expect(errors.some((e) => e.property === 'event')).toBe(true);
  });

  it('fails when event is invalid value', async () => {
    const errors = await validateDto({
      event: 'created',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 1,
    });
    expect(errors.some((e) => e.property === 'event')).toBe(true);
  });

  it('fails when userId is missing', async () => {
    const errors = await validateDto({
      event: 'renewed',
      creatorId: 'GCREATOR',
      planId: 1,
    });
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('fails when creatorId is missing', async () => {
    const errors = await validateDto({
      event: 'renewed',
      userId: 'GFAN',
      planId: 1,
    });
    expect(errors.some((e) => e.property === 'creatorId')).toBe(true);
  });

  it('fails when planId is missing', async () => {
    const errors = await validateDto({
      event: 'renewed',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
    });
    expect(errors.some((e) => e.property === 'planId')).toBe(true);
  });

  it('fails when planId is zero', async () => {
    const errors = await validateDto({
      event: 'renewed',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 0,
    });
    expect(errors.some((e) => e.property === 'planId')).toBe(true);
  });

  it('fails when planId is negative', async () => {
    const errors = await validateDto({
      event: 'renewed',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: -1,
    });
    expect(errors.some((e) => e.property === 'planId')).toBe(true);
  });

  it('fails when expiry is negative', async () => {
    const errors = await validateDto({
      event: 'renewed',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 1,
      expiry: -100,
    });
    expect(errors.some((e) => e.property === 'expiry')).toBe(true);
  });

  it('fails when cancelledAt is negative', async () => {
    const errors = await validateDto({
      event: 'cancelled',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 1,
      cancelledAt: -1,
    });
    expect(errors.some((e) => e.property === 'cancelledAt')).toBe(true);
  });

  it('passes for valid renewed event', async () => {
    const errors = await validateDto({
      event: 'renewed',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 1,
      expiry: 1700000000,
    });
    expect(errors).toHaveLength(0);
  });

  it('passes for valid cancelled event', async () => {
    const errors = await validateDto({
      event: 'cancelled',
      userId: 'GFAN',
      creatorId: 'GCREATOR',
      planId: 1,
      cancelledAt: 1700000000,
    });
    expect(errors).toHaveLength(0);
  });
});

describe('SetSpendingCapDto – invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(SetSpendingCapDto, plain);
    return validate(dto);
  }

  // 'weekly' | 'monthly' | 'total' are the valid CapPeriod values.
  it('fails when period is invalid', async () => {
    const errors = await validateDto({ period: 'daily' });
    expect(errors.some((e) => e.property === 'period')).toBe(true);
  });

  it('fails when capAmount is negative', async () => {
    const errors = await validateDto({ capAmount: -100, period: 'monthly' });
    expect(errors.some((e) => e.property === 'capAmount')).toBe(true);
  });

  it('fails when capAmount is a float', async () => {
    const errors = await validateDto({ capAmount: 10.5, period: 'monthly' });
    expect(errors.some((e) => e.property === 'capAmount')).toBe(true);
  });

  it('passes when capAmount is zero', async () => {
    const errors = await validateDto({ capAmount: 0, period: 'monthly' });
    expect(errors.filter((e) => e.property === 'capAmount')).toHaveLength(0);
  });

  it('passes when capAmount is omitted', async () => {
    const errors = await validateDto({ period: 'monthly' });
    expect(errors.filter((e) => e.property === 'capAmount')).toHaveLength(0);
  });
});

describe('FanDashboardQueryDto – invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(FanDashboardQueryDto, plain);
    return validate(dto);
  }

  it('fails when page is zero', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('fails when page is negative', async () => {
    const errors = await validateDto({ page: -1 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('fails when limit is zero', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('fails when limit exceeds maximum', async () => {
    const errors = await validateDto({ limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('passes with valid page and limit', async () => {
    const errors = await validateDto({ page: 1, limit: 50 });
    expect(errors).toHaveLength(0);
  });

  it('passes when both are omitted', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });
});
