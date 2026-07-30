import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DashboardQueryDto } from './creator-dashboard.dto';

describe('DashboardQueryDto', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(DashboardQueryDto, plain);
    return validate(dto);
  }

  describe('window parameter validation', () => {
    it('should accept valid window values', async () => {
      const validWindows = ['7d', '30d', '90d', 'all'];
      for (const window of validWindows) {
        const errors = await validateDto({ window });
        expect(errors).toHaveLength(0);
      }
    });

    it('should reject invalid window value', async () => {
      const errors = await validateDto({ window: 'invalid' });
      expect(errors.length).toBeGreaterThan(0);
      const windowError = errors.find((e) => e.property === 'window');
      expect(windowError).toBeDefined();
      expect(windowError?.constraints).toHaveProperty('isIn');
    });

    it('should reject numeric window value', async () => {
      const errors = await validateDto({ window: 30 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should apply default window value of 30d when omitted', () => {
      const dto = plainToInstance(DashboardQueryDto, {});
      expect(dto.window).toBe('30d');
    });

    it('should accept window as optional parameter', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });
  });

  describe('from parameter validation (date string)', () => {
    it('should accept valid ISO date string', async () => {
      const errors = await validateDto({ from: '2026-01-15T10:30:00Z' });
      expect(errors).toHaveLength(0);
    });

    it('should accept date-only format', async () => {
      const errors = await validateDto({ from: '2026-01-15' });
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid date format', async () => {
      const errors = await validateDto({ from: 'not-a-date' });
      expect(errors.length).toBeGreaterThan(0);
      const fromError = errors.find((e) => e.property === 'from');
      expect(fromError).toBeDefined();
      expect(fromError?.constraints).toHaveProperty('isDateString');
    });

    it('should reject numeric from value', async () => {
      const errors = await validateDto({ from: 1234567890 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept from as optional parameter', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });

    it('should accept from as null or undefined', async () => {
      const errors = await validateDto({ from: undefined });
      expect(errors).toHaveLength(0);
    });
  });

  describe('to parameter validation (date string)', () => {
    it('should accept valid ISO date string', async () => {
      const errors = await validateDto({ to: '2026-12-31T23:59:59Z' });
      expect(errors).toHaveLength(0);
    });

    it('should accept date-only format', async () => {
      const errors = await validateDto({ to: '2026-12-31' });
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid date format', async () => {
      const errors = await validateDto({ to: 'invalid-date' });
      expect(errors.length).toBeGreaterThan(0);
      const toError = errors.find((e) => e.property === 'to');
      expect(toError).toBeDefined();
      expect(toError?.constraints).toHaveProperty('isDateString');
    });

    it('should reject numeric to value', async () => {
      const errors = await validateDto({ to: 9999999999 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept to as optional parameter', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });

    it('should accept to as null or undefined', async () => {
      const errors = await validateDto({ to: undefined });
      expect(errors).toHaveLength(0);
    });
  });

  describe('combined validation', () => {
    it('should accept all valid parameters together', async () => {
      const errors = await validateDto({
        window: '7d',
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-07T23:59:59Z',
      });
      expect(errors).toHaveLength(0);
    });

    it('should validate multiple errors simultaneously', async () => {
      const errors = await validateDto({
        window: 'quarterly',
        from: 'not-a-date',
        to: 'also-not-a-date',
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'window')).toBe(true);
      expect(errors.some((e) => e.property === 'from')).toBe(true);
      expect(errors.some((e) => e.property === 'to')).toBe(true);
    });

    it('should accept partial parameters with defaults', async () => {
      const errors = await validateDto({
        from: '2026-01-01',
      });
      expect(errors).toHaveLength(0);
    });

    it('should accept only window with date range', async () => {
      const errors = await validateDto({
        window: '90d',
        from: '2025-10-01',
        to: '2025-12-31',
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });

    it('should accept null window value (optional field)', async () => {
      // Note: @IsOptional() allows null, so null should pass
      const errors = await validateDto({ window: null });
      expect(errors).toHaveLength(0);
    });

    it('should reject uppercase window string', async () => {
      const errors = await validateDto({ window: '7D' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should preserve whitespace in date string', () => {
      const dto = plainToInstance(DashboardQueryDto, {
        from: '  2026-01-15  ',
      });
      expect(dto.from).toBe('  2026-01-15  ');
    });

    it('should accept leap year date', async () => {
      const errors = await validateDto({ from: '2024-02-29' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('window-specific behavior', () => {
    it('should accept 7d window value', async () => {
      const errors = await validateDto({ window: '7d' });
      expect(errors).toHaveLength(0);
    });

    it('should accept 30d window value', async () => {
      const errors = await validateDto({ window: '30d' });
      expect(errors).toHaveLength(0);
    });

    it('should accept 90d window value', async () => {
      const errors = await validateDto({ window: '90d' });
      expect(errors).toHaveLength(0);
    });

    it('should accept all window value', async () => {
      const errors = await validateDto({ window: 'all' });
      expect(errors).toHaveLength(0);
    });
  });
});
