import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';

vi.mock('@/hooks/useWallet');
vi.mock('@/lib/auth-storage');
vi.mock('@/lib/api/profile');

import { useWallet } from '@/hooks/useWallet';
import { hasStoredUserId, clearStoredUserId } from '@/lib/auth-storage';
import { fetchMe } from '@/lib/api/profile';

const mockMeData = {
  id: 'user-123',
  email: 'test@example.com',
  is_creator: false,
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  website_url: null,
  x_handle: null,
  instagram_handle: null,
  other_url: null,
  creator: null,
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useWallet as any).mockReturnValue({
      isConnected: false,
      hasCheckedConnection: true,
    });

    (hasStoredUserId as any).mockReturnValue(false);
    (clearStoredUserId as any).mockImplementation(() => {});
    (fetchMe as any).mockResolvedValue(mockMeData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns not authenticated when wallet disconnected and no stored session', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.hasStoredSession).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.sessionData).toBeNull();
    });

    it('shows loading when wallet is still being checked', () => {
      (useWallet as any).mockReturnValue({
        isConnected: false,
        hasCheckedConnection: false,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('returns authenticated when wallet is connected', () => {
      (useWallet as any).mockReturnValue({
        isConnected: true,
        hasCheckedConnection: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('server session validation', () => {
    it('validates stored session by calling fetchMe', async () => {
      (hasStoredUserId as any).mockReturnValue(true);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(fetchMe).toHaveBeenCalled();
      expect(result.current.sessionData).toEqual(mockMeData);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('clears stale token on validation failure', async () => {
      (hasStoredUserId as any).mockReturnValue(true);
      (fetchMe as any).mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(clearStoredUserId).toHaveBeenCalled();
      expect(result.current.sessionData).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.validationError).toBe('Unauthorized');
    });

    it('skips validation when wallet is connected', async () => {
      (hasStoredUserId as any).mockReturnValue(true);
      (useWallet as any).mockReturnValue({
        isConnected: true,
        hasCheckedConnection: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(fetchMe).not.toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('prefers wallet connection over stored session', () => {
      (hasStoredUserId as any).mockReturnValue(true);
      (useWallet as any).mockReturnValue({
        isConnected: true,
        hasCheckedConnection: true,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(fetchMe).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('captures validation error message', async () => {
      const errorMsg = 'Session expired';
      (hasStoredUserId as any).mockReturnValue(true);
      (fetchMe as any).mockRejectedValue(new Error(errorMsg));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.validationError).toBe(errorMsg);
      });
    });

    it('handles non-Error rejection gracefully', async () => {
      (hasStoredUserId as any).mockReturnValue(true);
      (fetchMe as any).mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.validationError).toBe('Session validation failed');
      });
    });
  });
});
