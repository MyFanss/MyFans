import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SearchCreatorsDto } from './search-creators.dto';

describe('SearchCreatorsDto', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(SearchCreatorsDto, plain);
    return validate(dto);
  }

  describe('query parameter (q)', () => {
    it('accepts optional query parameter (undefined accepted)', async () => {
      const errors = await validateDto({});
      expect(errors).toHaveLength(0);
    });

    it('accepts valid query string', async () => {
      const errors = await validateDto({ q: 'john' });
      expect(errors).toHaveLength(0);
    });

    it('trims whitespace from query parameter', async () => {
      const dto = plainToInstance(SearchCreatorsDto, { q: '  john  ' });
      expect(dto.q).toBe('john');
    });

    it('treats whitespace-only query as empty string', async () => {
      const dto = plainToInstance(SearchCreatorsDto, { q: '   ' });
      expect(dto.q).toBe('');
    });

    it('rejects query exceeding 100 characters', async () => {
      const longQuery = 'a'.repeat(101);
      const errors = await validateDto({ q: longQuery });
      
      expect(errors.length).toBeGreaterThan(0);
      const queryError = errors.find(e => e.property === 'q');
      expect(queryError).toBeDefined();
      expect(queryError?.constraints).toHaveProperty('maxLength');
    });

    it('accepts query with exactly 100 characters', async () => {
      const maxQuery = 'a'.repeat(100);
      const errors = await validateDto({ q: maxQuery });
      expect(errors).toHaveLength(0);
    });

    it('accepts alphanumeric characters', async () => {
      const errors = await validateDto({ q: 'john123' });
      expect(errors).toHaveLength(0);
    });

    it('accepts spaces in query', async () => {
      const errors = await validateDto({ q: 'john doe' });
      expect(errors).toHaveLength(0);
    });

    it('accepts hyphens in query', async () => {
      const errors = await validateDto({ q: 'john-doe' });
      expect(errors).toHaveLength(0);
    });

    it('accepts underscores in query', async () => {
      const errors = await validateDto({ q: 'john_doe' });
      expect(errors).toHaveLength(0);
    });

    it('rejects non-string query parameter', async () => {
      const errors = await validateDto({ q: 123 });
      
      expect(errors.length).toBeGreaterThan(0);
      const queryError = errors.find(e => e.property === 'q');
      expect(queryError).toBeDefined();
      expect(queryError?.constraints).toHaveProperty('isString');
    });
  });

  describe('inherited pagination validation', () => {
    it('accepts valid page parameter', async () => {
      const errors = await validateDto({ page: 1 });
      expect(errors).toHaveLength(0);
    });

    it('accepts valid limit parameter', async () => {
      const errors = await validateDto({ limit: 20 });
      expect(errors).toHaveLength(0);
    });

    it('rejects page less than 1', async () => {
      const errors = await validateDto({ page: 0 });
      
      expect(errors.length).toBeGreaterThan(0);
      const pageError = errors.find(e => e.property === 'page');
      expect(pageError).toBeDefined();
      expect(pageError?.constraints).toHaveProperty('min');
    });

    it('rejects negative page', async () => {
      const errors = await validateDto({ page: -1 });
      
      expect(errors.length).toBeGreaterThan(0);
      const pageError = errors.find(e => e.property === 'page');
      expect(pageError).toBeDefined();
    });

    it('rejects limit less than 1', async () => {
      const errors = await validateDto({ limit: 0 });
      
      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find(e => e.property === 'limit');
      expect(limitError).toBeDefined();
      expect(limitError?.constraints).toHaveProperty('min');
    });

    it('rejects limit greater than 100', async () => {
      const errors = await validateDto({ limit: 101 });
      
      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find(e => e.property === 'limit');
      expect(limitError).toBeDefined();
      expect(limitError?.constraints).toHaveProperty('max');
    });

    it('accepts limit of exactly 100', async () => {
      const errors = await validateDto({ limit: 100 });
      expect(errors).toHaveLength(0);
    });

    it('rejects non-integer page', async () => {
      const errors = await validateDto({ page: 1.5 });
      
      expect(errors.length).toBeGreaterThan(0);
      const pageError = errors.find(e => e.property === 'page');
      expect(pageError).toBeDefined();
      expect(pageError?.constraints).toHaveProperty('isInt');
    });

    it('rejects non-integer limit', async () => {
      const errors = await validateDto({ limit: 20.5 });
      
      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find(e => e.property === 'limit');
      expect(limitError).toBeDefined();
      expect(limitError?.constraints).toHaveProperty('isInt');
    });

    it('applies default page value of 1 when omitted', () => {
      const dto = plainToInstance(SearchCreatorsDto, {});
      expect(dto.page).toBe(1);
    });

    it('applies default limit value of 20 when omitted', () => {
      const dto = plainToInstance(SearchCreatorsDto, {});
      expect(dto.limit).toBe(20);
    });

    it('converts string page to number', () => {
      const dto = plainToInstance(SearchCreatorsDto, { page: '2' });
      expect(dto.page).toBe(2);
      expect(typeof dto.page).toBe('number');
    });

    it('converts string limit to number', () => {
      const dto = plainToInstance(SearchCreatorsDto, { limit: '50' });
      expect(dto.limit).toBe(50);
      expect(typeof dto.limit).toBe('number');
    });
  });

  describe('combined validation', () => {
    it('accepts all valid parameters together', async () => {
      const errors = await validateDto({
        q: 'john',
        page: 2,
        limit: 50,
      });
      expect(errors).toHaveLength(0);
    });

    it('validates multiple errors simultaneously', async () => {
      const errors = await validateDto({
        q: 'a'.repeat(101),
        page: 0,
        limit: 101,
      });
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'q')).toBe(true);
      expect(errors.some(e => e.property === 'page')).toBe(true);
      expect(errors.some(e => e.property === 'limit')).toBe(true);
    });

    it('accepts query with pagination defaults', async () => {
      const dto = plainToInstance(SearchCreatorsDto, { q: 'john' });
      expect(dto.q).toBe('john');
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });
  });
});
