import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePlanDto } from './create-plan.dto';

describe('CreatePlanDto', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(CreatePlanDto, plain);
    return validate(dto);
  }

  describe('creator field validation', () => {
    it('should accept valid creator address', async () => {
      const errors = await validateDto({
        creator: 'GAB6JCKQE3GGH4PGBHQL5YHSAADQQ7LGFBKZZ2KFHQEKMM4SQC2QJVB',
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });
      expect(errors).toHaveLength(0);
    });

    it('should reject missing creator field', async () => {
      const errors = await validateDto({
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
      const creatorError = errors.find((e) => e.property === 'creator');
      expect(creatorError).toBeDefined();
    });

    it('should reject empty creator string', async () => {
      const errors = await validateDto({
        creator: '',
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject null creator', async () => {
      const errors = await validateDto({
        creator: null,
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string creator', async () => {
      const errors = await validateDto({
        creator: 12345,
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
      const creatorError = errors.find((e) => e.property === 'creator');
      expect(creatorError?.constraints).toHaveProperty('isString');
    });
  });

  describe('asset field validation', () => {
    it('should accept valid asset code', async () => {
      const validAssets = ['USDC', 'XLM', 'ETH', 'BTC', 'USD'];
      for (const asset of validAssets) {
        const errors = await validateDto({
          creator: 'creator1',
          asset,
          amount: '100',
          intervalDays: 30,
        });
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject missing asset field', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
      const assetError = errors.find((e) => e.property === 'asset');
      expect(assetError).toBeDefined();
    });

    it('should reject empty asset string', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: '',
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string asset', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 123,
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
      const assetError = errors.find((e) => e.property === 'asset');
      expect(assetError?.constraints).toHaveProperty('isString');
    });

    it('should reject null asset', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: null,
        amount: '100',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('amount field validation', () => {
    it('should accept valid decimal amount as string', async () => {
      const validAmounts = ['100', '100.50', '0.01', '999999.99'];
      for (const amount of validAmounts) {
        const errors = await validateDto({
          creator: 'creator1',
          asset: 'USDC',
          amount,
          intervalDays: 30,
        });
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject missing amount field', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
      const amountError = errors.find((e) => e.property === 'amount');
      expect(amountError).toBeDefined();
    });

    it('should reject empty amount string', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '',
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject numeric amount (must be string)', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: 100,
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
      const amountError = errors.find((e) => e.property === 'amount');
      expect(amountError?.constraints).toHaveProperty('isString');
    });

    it('should reject null amount', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: null,
        intervalDays: 30,
      });

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('intervalDays field validation', () => {
    it('should accept valid intervalDays values', async () => {
      const validIntervals = [1, 7, 14, 30, 90, 180, 365];
      for (const interval of validIntervals) {
        const errors = await validateDto({
          creator: 'creator1',
          asset: 'USDC',
          amount: '100',
          intervalDays: interval,
        });
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject missing intervalDays field', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
      });

      expect(errors.length).toBeGreaterThan(0);
      const intervalError = errors.find((e) => e.property === 'intervalDays');
      expect(intervalError).toBeDefined();
    });

    it('should reject intervalDays less than 1', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 0,
      });

      expect(errors.length).toBeGreaterThan(0);
      const intervalError = errors.find((e) => e.property === 'intervalDays');
      expect(intervalError?.constraints).toHaveProperty('min');
    });

    it('should reject negative intervalDays', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: -10,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject intervalDays greater than 365', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 366,
      });

      expect(errors.length).toBeGreaterThan(0);
      const intervalError = errors.find((e) => e.property === 'intervalDays');
      expect(intervalError?.constraints).toHaveProperty('max');
    });

    it('should reject non-numeric intervalDays', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 'thirty',
      });

      expect(errors.length).toBeGreaterThan(0);
      const intervalError = errors.find((e) => e.property === 'intervalDays');
      expect(intervalError?.constraints).toHaveProperty('isNumber');
    });

    it('should reject null intervalDays', async () => {
      const errors = await validateDto({
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: null,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept floating point intervalDays as number type', () => {
      // Note: class-validator's isNumber accepts floats, so 30.5 passes isNumber check
      // but exceeds Max(365) check is still applied
      const dto = plainToInstance(CreatePlanDto, {
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 30.5,
      });
      expect(typeof dto.intervalDays).toBe('number');
    });
  });

  describe('combined validation', () => {
    it('should accept all valid parameters together', async () => {
      const errors = await validateDto({
        creator: 'GAB6JCKQE3GGH4PGBHQL5YHSAADQQ7LGFBKZZ2KFHQEKMM4SQC2QJVB',
        asset: 'USDC',
        amount: '100.50',
        intervalDays: 30,
      });
      expect(errors).toHaveLength(0);
    });

    it('should validate multiple errors simultaneously', async () => {
      const errors = await validateDto({
        creator: '',
        asset: 123,
        amount: 100,
        intervalDays: 999,
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'creator')).toBe(true);
      expect(errors.some((e) => e.property === 'asset')).toBe(true);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
      expect(errors.some((e) => e.property === 'intervalDays')).toBe(true);
    });

    it('should reject all missing required fields', async () => {
      const errors = await validateDto({});

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'creator')).toBe(true);
      expect(errors.some((e) => e.property === 'asset')).toBe(true);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
      expect(errors.some((e) => e.property === 'intervalDays')).toBe(true);
    });

    it('should accept minimum and maximum boundary values', async () => {
      const errors = await validateDto({
        creator: 'c',
        asset: 'a',
        amount: '1',
        intervalDays: 365,
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('type transformation', () => {
    it('should preserve string types after transformation', () => {
      const dto = plainToInstance(CreatePlanDto, {
        creator: 'creator1',
        asset: 'USDC',
        amount: '100.50',
        intervalDays: 30,
      });

      expect(typeof dto.creator).toBe('string');
      expect(typeof dto.asset).toBe('string');
      expect(typeof dto.amount).toBe('string');
      expect(typeof dto.intervalDays).toBe('number');
    });

    it('should preserve numeric intervalDays as number type', () => {
      const dto = plainToInstance(CreatePlanDto, {
        creator: 'creator1',
        asset: 'USDC',
        amount: '100',
        intervalDays: 30,
      });

      expect(dto.intervalDays).toBe(30);
      expect(typeof dto.intervalDays).toBe('number');
    });
  });
});
