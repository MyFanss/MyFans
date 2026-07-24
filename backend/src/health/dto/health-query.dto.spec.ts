import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { HealthQueryDto } from './health-query.dto';

async function validateDto(plain: object) {
  return validate(plainToInstance(HealthQueryDto, plain));
}

describe('HealthQueryDto', () => {
  it('accepts valid page and limit', async () => {
    expect(await validateDto({ page: 1, limit: 10 })).toHaveLength(0);
  });

  it('accepts empty input (all fields optional)', async () => {
    expect(await validateDto({})).toHaveLength(0);
  });

  it('rejects page = 0', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects negative page', async () => {
    const errors = await validateDto({ page: -1 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects non-integer page', async () => {
    const errors = await validateDto({ page: 1.5 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit = 0', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit > 100', async () => {
    const errors = await validateDto({ limit: 101 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects non-integer limit', async () => {
    const errors = await validateDto({ limit: 2.5 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts limit at boundary values 1 and 100', async () => {
    expect(await validateDto({ limit: 1 })).toHaveLength(0);
    expect(await validateDto({ limit: 100 })).toHaveLength(0);
  });
});
