/**
 * Unit tests for the Subscribers CSV export helper — #2015.
 *
 * buildCsvRow is the single place every allowlisted export field flows
 * through, so it must neutralize spreadsheet formula injection (CSV
 * injection) while still escaping embedded double quotes per RFC 4180 and
 * leaving ordinary values unchanged.
 */
import { describe, expect, it } from 'vitest';

import { reducer, initialState, buildCsvRow, EXPORT_ALLOWED_FIELDS, type Action, type Subscriber } from './page';

function subscriber(overrides: Partial<Record<string, string>> = {}) {
  return {
    id: 'sub_1',
    planId: 'plan_1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('subscribers dashboard reducer', () => {
  it('LOADED (replace) sets items, cursor, hasMore and total', () => {
    const state = reducer(initialState, {
      type: 'LOADED',
      items: [subscriber('1')],
      cursor: 'c1',
      total: 42,
      append: false,
    } as Action);

    expect(state.items.map((i) => i.id)).toEqual(['1']);
    expect(state.loading).toBe(false);
    expect(state.hasMore).toBe(true);
    expect(state.total).toBe(42);
  });

  it('LOAD_MORE then LOADED with append: true appends without dropping existing items', () => {
    const page1 = reducer(initialState, {
      type: 'LOADED',
      items: [subscriber('1')],
      cursor: 'c1',
      total: 2,
      append: false,
    } as Action);
    const loading = reducer(page1, { type: 'LOAD_MORE' } as Action);
    expect(loading.loading).toBe(true);

    const page2 = reducer(loading, {
      type: 'LOADED',
      items: [subscriber('2')],
      cursor: null,
      total: null,
      append: true,
    } as Action);

    expect(page2.items.map((i) => i.id)).toEqual(['1', '2']);
    expect(page2.loading).toBe(false);
    expect(page2.hasMore).toBe(false);
    // A null total on the append page must not erase the previously known total.
    expect(page2.total).toBe(2);
  });

  it('ERROR stops loading and stores the message', () => {
    const state = reducer(initialState, { type: 'ERROR', message: 'boom' } as Action);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('boom');
  });

  it('SHOW_EXPORT_CONFIRM / CANCEL_EXPORT toggle the confirm dialog', () => {
    const shown = reducer(initialState, { type: 'SHOW_EXPORT_CONFIRM' } as Action);
    expect(shown.showExportConfirm).toBe(true);
    const cancelled = reducer(shown, { type: 'CANCEL_EXPORT' } as Action);
    expect(cancelled.showExportConfirm).toBe(false);
  });

  it('EXPORTING / EXPORT_DONE toggle the exporting flag and close the dialog', () => {
    const shown = reducer(initialState, { type: 'SHOW_EXPORT_CONFIRM' } as Action);
    const exporting = reducer(shown, { type: 'EXPORTING' } as Action);
    expect(exporting.exporting).toBe(true);
    expect(exporting.showExportConfirm).toBe(false);

    const done = reducer(exporting, { type: 'EXPORT_DONE' } as Action);
    expect(done.exporting).toBe(false);
  });
});

describe('buildCsvRow', () => {
  it('neutralizes a value starting with "="', () => {
    const row = buildCsvRow(subscriber({ id: '=SUM(A1:A9)' }));
    expect(row.startsWith('"\'=SUM')).toBe(true);
    expect(row).not.toContain('"=SUM');
  });

  it('neutralizes values starting with "+", "-", "@", a tab, or a carriage return', () => {
    expect(buildCsvRow(subscriber({ id: '+1' })).startsWith('"\'+1')).toBe(true);
    expect(buildCsvRow(subscriber({ id: '-1' })).startsWith('"\'-1')).toBe(true);
    expect(buildCsvRow(subscriber({ id: '@cmd' })).startsWith('"\'@cmd')).toBe(true);
    expect(buildCsvRow(subscriber({ id: '\tcmd' })).startsWith('"\'\tcmd')).toBe(true);
    expect(buildCsvRow(subscriber({ id: '\rcmd' })).startsWith('"\'\rcmd')).toBe(true);
  });

  it('still escapes an embedded double quote as ""', () => {
    const row = buildCsvRow(subscriber({ planId: 'plan_"vip"' }));
    expect(row).toContain('plan_""vip""');
  });

  it('leaves a normal value unchanged (aside from the surrounding quotes)', () => {
    const row = buildCsvRow(subscriber());
    expect(row).toBe('"sub_1","plan_1","active","2026-01-01T00:00:00.000Z"');
  });

  it('wraps every cell in quotes even after the formula-injection prefix is added', () => {
    const row = buildCsvRow(subscriber({ status: '=cmd' }));
    const cells = row.split(',');
    for (const cell of cells) {
      expect(cell.startsWith('"')).toBe(true);
      expect(cell.endsWith('"')).toBe(true);
    }
  });

  it('includes only the allowlisted fields, in order', () => {
    const row = buildCsvRow(subscriber('1'));
    expect(row).toBe('"1","plan_1","active","2026-01-01T00:00:00.000Z"');
  });

  it('never includes wallet address or email even if present on the object', () => {
    const withPii = { ...subscriber('1'), walletAddress: 'GSOMEADDRESS', email: 'fan@example.com' } as Subscriber;
    const row = buildCsvRow(withPii);
    expect(row).not.toContain('GSOMEADDRESS');
    expect(row).not.toContain('fan@example.com');
  });

  it('escapes embedded double quotes per RFC 4180', () => {
    const quoted = { ...subscriber('1'), status: 'weird"status' };
    const row = buildCsvRow(quoted);
    expect(row).toContain('"weird""status"');
  });
});

describe('EXPORT_ALLOWED_FIELDS', () => {
  it('matches the header row and excludes walletAddress/email', () => {
    expect(EXPORT_ALLOWED_FIELDS.join(',')).toBe('id,planId,status,createdAt');
    expect(EXPORT_ALLOWED_FIELDS).not.toContain('walletAddress');
    expect(EXPORT_ALLOWED_FIELDS).not.toContain('email');
  });
});
