import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUserLocale,
  formatCurrency,
  formatCurrencyCompact,
  getCurrencySymbol,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatNumberCompact,
  formatPercentage,
  formatFileSize,
  formatDuration,
  formatList,
} from '../formatting';

describe('Formatting Utilities', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  describe('getUserLocale', () => {
    it('should return default locale when window is undefined', () => {
      const locale = getUserLocale();
      expect(locale).toBe('en-US');
    });

    it('should return browser locale when available', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      const locale = getUserLocale();
      expect(locale).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      const result = formatCurrency(1234.56, 'USD', 'en-US');
      expect(result).toBe('$1,234.56');
    });

    it('should format EUR currency correctly', () => {
      const result = formatCurrency(1234.56, 'EUR', 'en-US');
      expect(result).toContain('1,234.56');
      expect(result).toContain('€');
    });

    it('should format GBP currency correctly', () => {
      const result = formatCurrency(1234.56, 'GBP', 'en-US');
      expect(result).toContain('1,234.56');
      expect(result).toContain('£');
    });

    it('should handle JPY (no decimal places)', () => {
      const result = formatCurrency(1234, 'JPY', 'en-US');
      expect(result).toContain('1,234');
      expect(result).not.toContain('.00');
    });

    it('should use default currency for invalid currency code', () => {
      const result = formatCurrency(1234.56, 'INVALID', 'en-US');
      expect(result).toContain('1,234.56');
    });

    it('should handle zero amount', () => {
      const result = formatCurrency(0, 'USD', 'en-US');
      expect(result).toBe('$0.00');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-1234.56, 'USD', 'en-US');
      expect(result).toContain('-');
      expect(result).toContain('1,234.56');
    });

    it('should respect custom options', () => {
      const result = formatCurrency(1234.567, 'USD', 'en-US', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
      expect(result).toContain('1,234.567');
    });
  });

  describe('formatCurrencyCompact', () => {
    it('should format thousands with K', () => {
      const result = formatCurrencyCompact(1234, 'USD', 'en-US');
      expect(result).toMatch(/\$1\.2K/);
    });

    it('should format millions with M', () => {
      const result = formatCurrencyCompact(1234567, 'USD', 'en-US');
      expect(result).toMatch(/\$1\.2M/);
    });

    it('should format billions with B', () => {
      const result = formatCurrencyCompact(1234567890, 'USD', 'en-US');
      expect(result).toMatch(/\$1\.2B/);
    });

    it('should handle small amounts', () => {
      const result = formatCurrencyCompact(123, 'USD', 'en-US');
      expect(result).toContain('123');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return $ for USD', () => {
      const symbol = getCurrencySymbol('USD', 'en-US');
      expect(symbol).toBe('$');
    });

    it('should return € for EUR', () => {
      const symbol = getCurrencySymbol('EUR', 'en-US');
      expect(symbol).toBe('€');
    });

    it('should return £ for GBP', () => {
      const symbol = getCurrencySymbol('GBP', 'en-US');
      expect(symbol).toBe('£');
    });

    it('should return currency code for invalid currency', () => {
      const symbol = getCurrencySymbol('INVALID', 'en-US');
      expect(symbol).toBe('INVALID');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T12:30:00Z');

    it('should format date with short style', () => {
      const result = formatDate(testDate, 'short', 'en-US');
      expect(result).toMatch(/1\/15\/24/);
    });

    it('should format date with medium style', () => {
      const result = formatDate(testDate, 'medium', 'en-US');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date with long style', () => {
      const result = formatDate(testDate, 'long', 'en-US');
      expect(result).toContain('January');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format date with full style', () => {
      const result = formatDate(testDate, 'full', 'en-US');
      expect(result).toContain('Monday');
      expect(result).toContain('January');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should handle ISO string input', () => {
      const result = formatDate('2024-01-15T12:30:00Z', 'medium', 'en-US');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should handle timestamp input', () => {
      const result = formatDate(testDate.getTime(), 'medium', 'en-US');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('should return empty string for invalid date', () => {
      const result = formatDate('invalid', 'medium', 'en-US');
      expect(result).toBe('');
    });

    it('should handle custom options', () => {
      const result = formatDate(testDate, { year: 'numeric', month: 'long' }, 'en-US');
      expect(result).toContain('January');
      expect(result).toContain('2024');
    });
  });

  describe('formatTime', () => {
    const testDate = new Date('2024-01-15T14:30:45Z');

    it('should format time in 12-hour format', () => {
      const result = formatTime(testDate, false, 'en-US');
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('should format time in 24-hour format', () => {
      const result = formatTime(testDate, true, 'en-US');
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    it('should handle ISO string input', () => {
      const result = formatTime('2024-01-15T14:30:45Z', false, 'en-US');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return empty string for invalid date', () => {
      const result = formatTime('invalid', false, 'en-US');
      expect(result).toBe('');
    });
  });

  describe('formatDateTime', () => {
    const testDate = new Date('2024-01-15T14:30:00Z');

    it('should format date and time together', () => {
      const result = formatDateTime(testDate, 'medium', false, 'en-US');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle 24-hour format', () => {
      const result = formatDateTime(testDate, 'medium', true, 'en-US');
      expect(result).toContain('Jan');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return empty string for invalid date', () => {
      const result = formatDateTime('invalid', 'medium', false, 'en-US');
      expect(result).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format "just now" for very recent times', () => {
      const now = new Date();
      const result = formatRelativeTime(now, 'en-US');
      expect(result).toBe('just now');
    });

    it('should format seconds ago', () => {
      const date = new Date(Date.now() - 30000); // 30 seconds ago
      const result = formatRelativeTime(date, 'en-US');
      expect(result).toContain('second');
      expect(result).toContain('ago');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 300000); // 5 minutes ago
      const result = formatRelativeTime(date, 'en-US');
      expect(result).toContain('minute');
      expect(result).toContain('ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 7200000); // 2 hours ago
      const result = formatRelativeTime(date, 'en-US');
      expect(result).toContain('hour');
      expect(result).toContain('ago');
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 172800000); // 2 days ago
      const result = formatRelativeTime(date, 'en-US');
      expect(result).toContain('day');
      expect(result).toContain('ago');
    });

    it('should format future times', () => {
      const date = new Date(Date.now() + 86400000); // 1 day from now
      const result = formatRelativeTime(date, 'en-US');
      expect(result).toMatch(/in|tomorrow/i);
    });

    it('should return empty string for invalid date', () => {
      const result = formatRelativeTime('invalid', 'en-US');
      expect(result).toBe('');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousands separators', () => {
      const result = formatNumber(1234567.89, undefined, 'en-US');
      expect(result).toBe('1,234,567.89');
    });

    it('should handle zero', () => {
      const result = formatNumber(0, undefined, 'en-US');
      expect(result).toBe('0');
    });

    it('should handle negative numbers', () => {
      const result = formatNumber(-1234.56, undefined, 'en-US');
      expect(result).toContain('-');
      expect(result).toContain('1,234.56');
    });

    it('should respect custom options', () => {
      const result = formatNumber(1234.567, { maximumFractionDigits: 0 }, 'en-US');
      expect(result).toBe('1,235');
    });
  });

  describe('formatNumberCompact', () => {
    it('should format thousands with K', () => {
      const result = formatNumberCompact(1234, 'en-US');
      expect(result).toMatch(/1\.2K/);
    });

    it('should format millions with M', () => {
      const result = formatNumberCompact(1234567, 'en-US');
      expect(result).toMatch(/1\.2M/);
    });

    it('should format billions with B', () => {
      const result = formatNumberCompact(1234567890, 'en-US');
      expect(result).toMatch(/1\.2B/);
    });

    it('should handle small numbers', () => {
      const result = formatNumberCompact(123, 'en-US');
      expect(result).toBe('123');
    });

    it('should handle negative numbers', () => {
      const result = formatNumberCompact(-1234567, 'en-US');
      expect(result).toContain('-');
      expect(result).toMatch(/1\.2M/);
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      const result = formatPercentage(0.1234, undefined, 'en-US');
      expect(result).toBe('12.3%');
    });

    it('should handle zero', () => {
      const result = formatPercentage(0, undefined, 'en-US');
      expect(result).toBe('0%');
    });

    it('should handle 100%', () => {
      const result = formatPercentage(1, undefined, 'en-US');
      expect(result).toBe('100%');
    });

    it('should respect custom options', () => {
      const result = formatPercentage(0.1234, { minimumFractionDigits: 2 }, 'en-US');
      expect(result).toContain('12.3');
      expect(result).toContain('%');
    });

    it('should handle negative percentages', () => {
      const result = formatPercentage(-0.1234, undefined, 'en-US');
      expect(result).toContain('-');
      expect(result).toContain('12.3%');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      const result = formatFileSize(512, 'en-US');
      expect(result).toBe('512 B');
    });

    it('should format kilobytes', () => {
      const result = formatFileSize(1024, 'en-US');
      expect(result).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
      const result = formatFileSize(1048576, 'en-US');
      expect(result).toBe('1.0 MB');
    });

    it('should format gigabytes', () => {
      const result = formatFileSize(1073741824, 'en-US');
      expect(result).toBe('1.0 GB');
    });

    it('should handle zero', () => {
      const result = formatFileSize(0, 'en-US');
      expect(result).toBe('0 B');
    });

    it('should format fractional sizes', () => {
      const result = formatFileSize(1536, 'en-US');
      expect(result).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      const result = formatDuration(45);
      expect(result).toBe('0:45');
    });

    it('should format minutes and seconds', () => {
      const result = formatDuration(90);
      expect(result).toBe('1:30');
    });

    it('should format hours, minutes, and seconds', () => {
      const result = formatDuration(3665);
      expect(result).toBe('1:01:05');
    });

    it('should handle zero', () => {
      const result = formatDuration(0);
      expect(result).toBe('0:00');
    });

    it('should pad single digits', () => {
      const result = formatDuration(65);
      expect(result).toBe('1:05');
    });
  });

  describe('formatList', () => {
    it('should format list with conjunction', () => {
      const result = formatList(['apples', 'oranges', 'bananas'], 'conjunction', 'en-US');
      expect(result).toContain('apples');
      expect(result).toContain('oranges');
      expect(result).toContain('bananas');
      expect(result).toMatch(/and/i);
    });

    it('should format list with disjunction', () => {
      const result = formatList(['apples', 'oranges'], 'disjunction', 'en-US');
      expect(result).toContain('apples');
      expect(result).toContain('oranges');
      expect(result).toMatch(/or/i);
    });

    it('should handle single item', () => {
      const result = formatList(['apples'], 'conjunction', 'en-US');
      expect(result).toBe('apples');
    });

    it('should handle empty array', () => {
      const result = formatList([], 'conjunction', 'en-US');
      expect(result).toBe('');
    });

    it('should handle two items', () => {
      const result = formatList(['apples', 'oranges'], 'conjunction', 'en-US');
      expect(result).toContain('apples');
      expect(result).toContain('oranges');
    });
  });
});
