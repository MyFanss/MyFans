/**
 * Tests for the uuid mock defined in backend/test-setup.ts.
 *
 * The mock is load-bearing for correlation-ID assertions across the backend
 * e2e suite, so we verify its contract here: uniqueness, v4 shape, and
 * named-vs-default export parity.
 */

// Ensure the Jest setup file (which installs the uuid mock) has run.
import './test-setup';

import uuidDefault, { v4 } from 'uuid';

const V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const numericSuffix = (value: string): number => {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : NaN;
};

describe('uuid mock (test-setup)', () => {
  it('returns different values for two consecutive v4() calls', () => {
    const first = v4();
    const second = v4();

    expect(first).not.toBe(second);
  });

  it('returns v4-shaped UUIDs', () => {
    expect(v4()).toMatch(V4_REGEX);
    expect(v4()).toMatch(V4_REGEX);
  });

  it('produces values from the same counter sequence for named and default exports', () => {
    const named = v4();
    const viaDefault = uuidDefault.v4();

    expect(named).not.toBe(viaDefault);
    expect(named).toMatch(V4_REGEX);
    expect(viaDefault).toMatch(V4_REGEX);

    // Both exports draw from the same monotonically increasing counter.
    expect(numericSuffix(viaDefault)).toBeGreaterThan(numericSuffix(named));
  });

  it('increments the counter monotonically', () => {
    const first = numericSuffix(v4());
    const second = numericSuffix(v4());
    const third = numericSuffix(v4());

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });
});
