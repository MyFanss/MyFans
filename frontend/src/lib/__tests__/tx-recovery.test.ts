/**
 * Tests for transaction failure detection and recovery guidance.
 */

import {
  detectFailureType,
  getRecoveryGuide,
  RECOVERY_GUIDES,
  type TxFailureType,
} from '../tx-recovery';
import { createAppError } from '@/types/errors';

// ── detectFailureType ──────────────────────────────────────────────────────

describe('detectFailureType', () => {
  it('maps TX_REJECTED to rejected_signature', () => {
    expect(detectFailureType(createAppError('TX_REJECTED'))).toBe('rejected_signature');
  });

  it('maps WALLET_SIGNATURE_FAILED to rejected_signature', () => {
    expect(detectFailureType(createAppError('WALLET_SIGNATURE_FAILED'))).toBe('rejected_signature');
  });

  it('maps NETWORK_FEE_ERROR to network_congestion', () => {
    expect(detectFailureType(createAppError('NETWORK_FEE_ERROR'))).toBe('network_congestion');
  });

  it('maps TX_TIMEOUT to timeout', () => {
    expect(detectFailureType(createAppError('TX_TIMEOUT'))).toBe('timeout');
  });

  it('maps NETWORK_TIMEOUT to timeout', () => {
    expect(detectFailureType(createAppError('NETWORK_TIMEOUT'))).toBe('timeout');
  });

  it('maps INSUFFICIENT_BALANCE to insufficient_funds', () => {
    expect(detectFailureType(createAppError('INSUFFICIENT_BALANCE'))).toBe('insufficient_funds');
  });

  it('maps INSUFFICIENT_FUNDS to insufficient_funds', () => {
    expect(detectFailureType(createAppError('INSUFFICIENT_FUNDS'))).toBe('insufficient_funds');
  });

  it('maps RPC_ERROR to rpc_error', () => {
    expect(detectFailureType(createAppError('RPC_ERROR'))).toBe('rpc_error');
  });

  it('maps NETWORK_ERROR to rpc_error', () => {
    expect(detectFailureType(createAppError('NETWORK_ERROR'))).toBe('rpc_error');
  });

  it('maps OFFLINE to offline', () => {
    expect(detectFailureType(createAppError('OFFLINE'))).toBe('offline');
  });

  it('maps CONNECTION_LOST to offline', () => {
    expect(detectFailureType(createAppError('CONNECTION_LOST'))).toBe('offline');
  });

  it('maps TX_BUILD_FAILED to build_failed', () => {
    expect(detectFailureType(createAppError('TX_BUILD_FAILED'))).toBe('build_failed');
  });

  it('maps TX_FAILED to generic', () => {
    expect(detectFailureType(createAppError('TX_FAILED'))).toBe('generic');
  });

  it('falls back to rejected_signature via message heuristic', () => {
    const err = createAppError('UNKNOWN_ERROR', { message: 'User rejected the request' });
    expect(detectFailureType(err)).toBe('rejected_signature');
  });

  it('falls back to network_congestion via message heuristic', () => {
    const err = createAppError('UNKNOWN_ERROR', { message: 'Fee surge detected on network' });
    expect(detectFailureType(err)).toBe('network_congestion');
  });

  it('falls back to insufficient_funds via message heuristic', () => {
    const err = createAppError('UNKNOWN_ERROR', { message: 'Insufficient balance for operation' });
    expect(detectFailureType(err)).toBe('insufficient_funds');
  });

  it('falls back to timeout via message heuristic', () => {
    const err = createAppError('UNKNOWN_ERROR', { message: 'Request timed out' });
    expect(detectFailureType(err)).toBe('timeout');
  });

  it('falls back to generic for unrecognised messages', () => {
    const err = createAppError('UNKNOWN_ERROR', { message: 'Something completely unexpected' });
    expect(detectFailureType(err)).toBe('generic');
  });
});

// ── getRecoveryGuide ───────────────────────────────────────────────────────

describe('getRecoveryGuide', () => {
  it('returns a guide for every failure type', () => {
    const types: TxFailureType[] = [
      'rejected_signature',
      'network_congestion',
      'insufficient_funds',
      'timeout',
      'rpc_error',
      'offline',
      'build_failed',
      'generic',
    ];
    for (const type of types) {
      expect(RECOVERY_GUIDES[type]).toBeDefined();
    }
  });

  it('rejected_signature guide has canRetry=true', () => {
    const guide = getRecoveryGuide(createAppError('TX_REJECTED'));
    expect(guide.canRetry).toBe(true);
  });

  it('insufficient_funds guide has canRetry=false', () => {
    const guide = getRecoveryGuide(createAppError('INSUFFICIENT_BALANCE'));
    expect(guide.canRetry).toBe(false);
  });

  it('network_congestion guide mentions waiting', () => {
    const guide = getRecoveryGuide(createAppError('NETWORK_FEE_ERROR'));
    const allText = guide.steps.join(' ').toLowerCase();
    expect(allText).toMatch(/wait/);
  });

  it('rejected_signature guide mentions approving in wallet', () => {
    const guide = getRecoveryGuide(createAppError('TX_REJECTED'));
    const allText = guide.steps.join(' ').toLowerCase();
    expect(allText).toMatch(/approve|wallet/);
  });

  it('timeout guide warns about duplicate charges', () => {
    const guide = getRecoveryGuide(createAppError('TX_TIMEOUT'));
    const allText = guide.steps.join(' ').toLowerCase();
    expect(allText).toMatch(/duplicate|history/);
  });

  it('every guide has at least one action', () => {
    for (const guide of Object.values(RECOVERY_GUIDES)) {
      expect(guide.actions.length).toBeGreaterThan(0);
    }
  });

  it('every guide has at least one primary action', () => {
    for (const guide of Object.values(RECOVERY_GUIDES)) {
      expect(guide.actions.some((a) => a.primary)).toBe(true);
    }
  });

  it('every guide has at least two recovery steps', () => {
    for (const guide of Object.values(RECOVERY_GUIDES)) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('network_congestion guide includes external link to Stellar dashboard', () => {
    const guide = RECOVERY_GUIDES['network_congestion'];
    const externalAction = guide.actions.find((a) => a.kind === 'external');
    expect(externalAction).toBeDefined();
    expect(externalAction?.href).toContain('stellar');
  });

  it('timeout guide includes external link to explorer', () => {
    const guide = RECOVERY_GUIDES['timeout'];
    const externalAction = guide.actions.find((a) => a.kind === 'external');
    expect(externalAction).toBeDefined();
  });
});
