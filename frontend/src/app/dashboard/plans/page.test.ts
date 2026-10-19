import { describe, expect, it } from 'vitest';
import { reducer, initialState, validate, metadataIdempotencyKey, type Action, type PlanForm as PlanFormValues } from './page';

const validForm: PlanFormValues = {
  title: 'My plan',
  description: '',
  asset: 'USDC',
  amount: '10',
  intervalDays: '30',
};

describe('plans dashboard reducer', () => {
  it('GO_REVIEW moves to the review step and clears globalError', () => {
    const errored = { ...initialState, globalError: 'oops' };
    const state = reducer(errored, { type: 'GO_REVIEW' } as Action);
    expect(state.step).toBe('review');
    expect(state.globalError).toBeNull();
  });

  it('VALIDATE stores field errors without changing the step', () => {
    const state = reducer(initialState, {
      type: 'VALIDATE',
      errors: { amount: 'Enter a positive number.' },
    } as Action);
    expect(state.formErrors.amount).toBe('Enter a positive number.');
    expect(state.step).toBe('form');
  });

  it('SIGN_DONE stores the signed XDR and on-chain plan id, advancing to posting_metadata', () => {
    const state = reducer(initialState, {
      type: 'SIGN_DONE',
      signedXdr: 'xdr-1',
      planId: 'plan_123',
    } as Action);
    expect(state.step).toBe('posting_metadata');
    expect(state.signedXdr).toBe('xdr-1');
    expect(state.onChainPlanId).toBe('plan_123');
  });

  it('METADATA_ERROR moves to metadata_retry and preserves the on-chain plan id', () => {
    const signed = reducer(initialState, {
      type: 'SIGN_DONE',
      signedXdr: 'xdr-1',
      planId: 'plan_123',
    } as Action);
    const errored = reducer(signed, { type: 'METADATA_ERROR', message: 'network error' } as Action);

    expect(errored.step).toBe('metadata_retry');
    expect(errored.metadataError).toBe('network error');
    expect(errored.onChainPlanId).toBe('plan_123');
  });

  it('METADATA_RETRY clears the error without losing the on-chain plan id', () => {
    const signed = reducer(initialState, {
      type: 'SIGN_DONE',
      signedXdr: 'xdr-1',
      planId: 'plan_123',
    } as Action);
    const errored = reducer(signed, { type: 'METADATA_ERROR', message: 'network error' } as Action);
    const retrying = reducer(errored, { type: 'METADATA_RETRY' } as Action);

    expect(retrying.metadataError).toBeNull();
    expect(retrying.onChainPlanId).toBe('plan_123');
  });

  it('METADATA_DONE resets the form and moves to done, replacing a retried duplicate instead of prepending it', () => {
    const plan = {
      planId: 'plan_123',
      creator: 'creator_1',
      asset: 'USDC',
      amount: '10',
      interval: '30d',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const first = reducer(initialState, { type: 'METADATA_DONE', plan } as Action);
    expect(first.step).toBe('done');
    expect(first.plans.map((p) => p.planId)).toEqual(['plan_123']);
    expect(first.form).toEqual(initialState.form);

    // A retried POST for the same planId must replace, not duplicate.
    const retried = { ...plan, amount: '20' };
    const second = reducer(first, { type: 'METADATA_DONE', plan: retried } as Action);
    expect(second.plans.map((p) => p.planId)).toEqual(['plan_123']);
    expect(second.plans[0].amount).toBe('20');
  });

  it('DISMISS_ERROR clears both globalError and metadataError', () => {
    const errored = { ...initialState, globalError: 'g', metadataError: 'm' };
    const state = reducer(errored, { type: 'DISMISS_ERROR' } as Action);
    expect(state.globalError).toBeNull();
    expect(state.metadataError).toBeNull();
  });
});

describe('validate', () => {
  it('accepts a fully valid form', () => {
    expect(validate(validForm)).toEqual({});
  });

  it('requires a title', () => {
    expect(validate({ ...validForm, title: '  ' }).title).toBeDefined();
  });

  it('requires a positive numeric amount', () => {
    expect(validate({ ...validForm, amount: '0' }).amount).toBeDefined();
    expect(validate({ ...validForm, amount: 'abc' }).amount).toBeDefined();
    expect(validate({ ...validForm, amount: '-5' }).amount).toBeDefined();
  });

  it('requires a positive integer interval', () => {
    expect(validate({ ...validForm, intervalDays: '0' }).intervalDays).toBeDefined();
    expect(validate({ ...validForm, intervalDays: '1.5' }).intervalDays).toBeDefined();
  });
});

describe('metadataIdempotencyKey', () => {
  it('is deterministic for the same planId', () => {
    expect(metadataIdempotencyKey('plan_123')).toBe(metadataIdempotencyKey('plan_123'));
  });

  it('differs across planIds', () => {
    expect(metadataIdempotencyKey('plan_1')).not.toBe(metadataIdempotencyKey('plan_2'));
  });
});
