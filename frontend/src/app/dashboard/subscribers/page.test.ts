/**
 * Unit tests for the Subscribers CSV export helper — #2015.
 *
 * buildCsvRow is the single place every allowlisted export field flows
 * through, so it must neutralize spreadsheet formula injection (CSV
 * injection) while still escaping embedded double quotes per RFC 4180 and
 * leaving ordinary values unchanged.
 */
import { describe, expect, it } from 'vitest';

import { buildCsvRow, EXPORT_ALLOWED_FIELDS } from './page';

function subscriber(overrides: Partial<Record<string, string>> = {}) {
  return {
    id: 'sub_1',
    planId: 'plan_1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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
});

describe('EXPORT_ALLOWED_FIELDS', () => {
  it('matches the header row and excludes walletAddress/email', () => {
    expect(EXPORT_ALLOWED_FIELDS.join(',')).toBe('id,planId,status,createdAt');
    expect(EXPORT_ALLOWED_FIELDS).not.toContain('walletAddress');
    expect(EXPORT_ALLOWED_FIELDS).not.toContain('email');
  });
});
