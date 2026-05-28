import { describe, expect, it } from 'vitest';
import {
  getIntervalDays,
  toAtomicPlanAmount,
  validateInterval,
  validatePlanForm,
  validatePrice,
  validateTokenAddress,
  type PlanFormValues,
} from './plan-form';

const VALID_CONTRACT = 'CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF';

function makeValues(overrides: Partial<PlanFormValues> = {}): PlanFormValues {
  return {
    name: 'Studio Pass',
    description: 'Behind the scenes drops',
    tokenAddress: VALID_CONTRACT,
    price: '12.50',
    interval: 'month',
    tier: 'pro',
    ...overrides,
  };
}

describe('plan-form validation', () => {
  it('accepts a valid Soroban contract token address', () => {
    expect(validateTokenAddress(VALID_CONTRACT)).toBeUndefined();
  });

  it('rejects an invalid token address', () => {
    expect(validateTokenAddress('GNOT_A_CONTRACT')).toBe('Enter a valid Soroban contract address');
  });

  it('rejects zero-priced plans', () => {
    expect(validatePrice('0')).toBe('Price must be greater than 0');
  });

  it('rejects unsupported intervals', () => {
    expect(validateInterval('weekly')).toBe('Select a billing interval');
  });

  it('returns field errors for invalid plan input', () => {
    expect(
      validatePlanForm(
        makeValues({
          tokenAddress: 'invalid',
          price: '',
          interval: 'year',
          name: '',
        }),
      ),
    ).toEqual({
      name: 'Name is required',
      tokenAddress: 'Enter a valid Soroban contract address',
      price: 'Price is required',
    });
  });
});

describe('plan-form helpers', () => {
  it('maps intervals to on-chain day counts', () => {
    expect(getIntervalDays('month')).toBe(30);
    expect(getIntervalDays('year')).toBe(365);
  });

  it('converts display prices into atomic token units', () => {
    expect(toAtomicPlanAmount('12.50', 7)).toBe('125000000');
  });
});
