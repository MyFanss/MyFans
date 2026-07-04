import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeatureFlagsQueryDto } from './feature-flags-query.dto';

async function validateDto(plain: object) {
  return validate(plainToInstance(FeatureFlagsQueryDto, plain));
}

describe('FeatureFlagsQueryDto', () => {
  it('accepts empty input', async () => {
    await expect(validateDto({})).resolves.toHaveLength(0);
  });

  it('accepts a single known feature flag name', async () => {
    await expect(validateDto({ names: 'bookmarks' })).resolves.toHaveLength(0);
  });

  it('accepts comma-separated known feature flag names', async () => {
    await expect(
      validateDto({ names: 'bookmarks,cryptoPayments' }),
    ).resolves.toHaveLength(0);
  });

  it('rejects an unknown feature flag name', async () => {
    const errors = await validateDto({ names: 'bookmarks,notAFlag' });

    expect(errors.some((error) => error.property === 'names')).toBe(true);
  });

  it('rejects an empty feature flag list when names is provided', async () => {
    const errors = await validateDto({ names: '' });

    expect(errors.some((error) => error.property === 'names')).toBe(true);
  });
});
