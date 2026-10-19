import { describe, expect, it, vi } from 'vitest';
import { WalletError, assertNetwork, connectFreighter, mapWalletError } from './freighter';
import { isConnected, requestAccess, getNetwork } from '@stellar/freighter-api';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
}));

describe('freighter.ts', () => {
  it('mapWalletError handles WalletError and error classification', () => {
    const orig = new WalletError('SIGN_FAILED', 'msg');
    expect(mapWalletError(orig)).toBe(orig);
    expect(mapWalletError('freighter not installed').code).toBe('FREIGHTER_MISSING');
    expect(mapWalletError('popup blocked').code).toBe('POPUP_BLOCKED');
    expect(mapWalletError('user rejected').code).toBe('USER_REJECTED');
    expect(mapWalletError('network mismatch').code).toBe('NETWORK_MISMATCH');
    expect(mapWalletError('unknown error').code).toBe('SIGN_FAILED');
    expect(mapWalletError('freighter reject').code).toBe('USER_REJECTED'); // ordering check
  });

  it('mapWalletError classifies USER_REJECTED before FREIGHTER_MISSING', () => {
    expect(mapWalletError('freighter reject').code).toBe('USER_REJECTED');
    expect(mapWalletError('freighter denied').code).toBe('USER_REJECTED');
    expect(mapWalletError('freighter cancel').code).toBe('USER_REJECTED');
    expect(mapWalletError('user rejected freighter').code).toBe('USER_REJECTED');
  });

  it('mapWalletError classifies NETWORK_MISMATCH before FREIGHTER_MISSING', () => {
    expect(mapWalletError('freighter network').code).toBe('NETWORK_MISMATCH');
    expect(mapWalletError('freighter passphrase').code).toBe('NETWORK_MISMATCH');
    expect(mapWalletError('network mismatch freighter').code).toBe('NETWORK_MISMATCH');
  });

  it('mapWalletError classifies FREIGHTER_MISSING for missing-extension phrases only', () => {
    expect(mapWalletError('not installed').code).toBe('FREIGHTER_MISSING');
    expect(mapWalletError('not available').code).toBe('FREIGHTER_MISSING');
    expect(mapWalletError('freighter').code).toBe('FREIGHTER_MISSING');
  });

  it('mapWalletError preserves POPUP_BLOCKED and SIGN_FAILED fallbacks', () => {
    expect(mapWalletError('popup blocked').code).toBe('POPUP_BLOCKED');
    expect(mapWalletError('some other error').code).toBe('SIGN_FAILED');
  });

  it('connectFreighter handles failure paths', async () => {
    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: false } as any);
    await expect(connectFreighter()).rejects.toMatchObject({ code: 'FREIGHTER_MISSING' });

    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: true } as any);
    vi.mocked(requestAccess).mockResolvedValueOnce({} as any);
    await expect(connectFreighter()).rejects.toMatchObject({ code: 'USER_REJECTED' });

    vi.mocked(isConnected).mockResolvedValueOnce({ isConnected: true } as any);
    vi.mocked(requestAccess).mockRejectedValueOnce(new Error('popup blocked'));
    await expect(connectFreighter()).rejects.toMatchObject({ code: 'POPUP_BLOCKED' });
  });

  it('assertNetwork checks passphrase', async () => {
    vi.mocked(getNetwork).mockResolvedValueOnce({ networkPassphrase: 'pass' } as any);
    await expect(assertNetwork('pass')).resolves.toBeUndefined();

    vi.mocked(getNetwork).mockResolvedValueOnce({ networkPassphrase: 'diff' } as any);
    await expect(assertNetwork('pass')).rejects.toMatchObject({ code: 'NETWORK_MISMATCH' });
  });
});
