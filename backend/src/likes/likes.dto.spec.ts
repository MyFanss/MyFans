import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetLikesQueryDto } from './dto/get-likes-query.dto';

describe('GetLikesQueryDto – DTO validation for invalid input', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(GetLikesQueryDto, plain);
    return validate(dto);
  }

  it('passes with an empty object (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('passes with valid page and limit', async () => {
    const errors = await validateDto({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('passes with maximum allowed limit of 100', async () => {
    const errors = await validateDto({ limit: 100 });
    expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
  });

  it('fails when page is 0 (below minimum of 1)', async () => {
    const errors = await validateDto({ page: 0 });
    const pageErrors = errors.filter((e) => e.property === 'page');
    expect(pageErrors.length).toBeGreaterThan(0);
    const constraints = Object.values(pageErrors[0].constraints ?? {});
    expect(constraints.some((c) => c.includes('1'))).toBe(true);
  });

  it('fails when page is negative', async () => {
    const errors = await validateDto({ page: -5 });
    const pageErrors = errors.filter((e) => e.property === 'page');
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  it('fails when limit is 0 (below minimum of 1)', async () => {
    const errors = await validateDto({ limit: 0 });
    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors.length).toBeGreaterThan(0);
  });

  it('fails when limit exceeds maximum of 100', async () => {
    const errors = await validateDto({ limit: 101 });
    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors.length).toBeGreaterThan(0);
  });

  it('fails when limit is a very large number', async () => {
    const errors = await validateDto({ limit: 9999 });
    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors.length).toBeGreaterThan(0);
  });

  it('fails when page is a non-numeric string', async () => {
    const errors = await validateDto({ page: 'abc' });
    const pageErrors = errors.filter((e) => e.property === 'page');
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  it('fails when limit is a non-numeric string', async () => {
    const errors = await validateDto({ limit: 'many' });
    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors.length).toBeGreaterThan(0);
  });

  it('coerces string numbers to integers via @Type(() => Number)', async () => {
    const errors = await validateDto({ page: '2', limit: '10' });
    expect(errors).toHaveLength(0);
  });
});
