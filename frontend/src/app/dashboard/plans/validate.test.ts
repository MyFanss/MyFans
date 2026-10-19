import { describe, expect, it } from 'vitest';
import { validate, type PlanForm } from './page';

const VALID_FORM: PlanForm = {
  title: 'Monthly tier',
  description: '',
  asset: 'USDC',
  amount: '5.5',
  intervalDays: '30',
};

describe('validate()', () => {
  it('accepts a well-formed form', () => {
    expect(validate(VALID_FORM)).toEqual({});
  });

  it('rejects amount "0"', () => {
    const errors = validate({ ...VALID_FORM, amount: '0' });
    expect(errors.amount).toBeDefined();
  });

  it('rejects amount "0.00"', () => {
    const errors = validate({ ...VALID_FORM, amount: '0.00' });
    expect(errors.amount).toBeDefined();
  });

  it('accepts amount "5.5"', () => {
    const errors = validate({ ...VALID_FORM, amount: '5.5' });
    expect(errors.amount).toBeUndefined();
  });

  it('rejects a negative amount', () => {
    const errors = validate({ ...VALID_FORM, amount: '-1' });
    expect(errors.amount).toBeDefined();
  });

  it('rejects intervalDays ""', () => {
    const errors = validate({ ...VALID_FORM, intervalDays: '' });
    expect(errors.intervalDays).toBeDefined();
  });

  it('rejects intervalDays "0"', () => {
    const errors = validate({ ...VALID_FORM, intervalDays: '0' });
    expect(errors.intervalDays).toBeDefined();
  });

  it('accepts intervalDays "30"', () => {
    const errors = validate({ ...VALID_FORM, intervalDays: '30' });
    expect(errors.intervalDays).toBeUndefined();
  });

  it('rejects a non-numeric intervalDays', () => {
    const errors = validate({ ...VALID_FORM, intervalDays: 'abc' });
    expect(errors.intervalDays).toBeDefined();
  });

  it('rejects a missing title', () => {
    const errors = validate({ ...VALID_FORM, title: '   ' });
    expect(errors.title).toBeDefined();
  });

  it('rejects a missing asset', () => {
    const errors = validate({ ...VALID_FORM, asset: '' });
    expect(errors.asset).toBeDefined();
  });
});
