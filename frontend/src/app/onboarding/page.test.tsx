/**
 * Unit tests for OnboardingPage — asserts that rapid double-invocation of
 * handleContinue (fast double-click, or Enter plus click) issues exactly one
 * persistRole call, and that the in-flight latch is released on error so a
 * retry still works.
 *
 * Closes #2004.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import OnboardingPage from './page';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/context/UserContext', () => ({
  useUser: () => ({ user: null, loading: false, refreshUser: mockRefreshUser }),
}));

vi.mock('@/lib/users-api', () => ({
  persistRole: vi.fn(),
}));
import { persistRole } from '@/lib/users-api';
const mockedPersistRole = vi.mocked(persistRole);

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('issues exactly one persistRole call when Continue is invoked twice synchronously', async () => {
    let resolvePersist!: (value: unknown) => void;
    mockedPersistRole.mockReturnValue(
      new Promise((resolve) => {
        resolvePersist = resolve;
      }),
    );

    render(<OnboardingPage />);
    await act(async () => {
      screen.getAllByRole('radio')[0].click();
    });

    const continueBtn = screen.getByRole('button', { name: /continue/i });

    // Two synchronous invocations in the same tick, before `saving` state
    // has re-rendered to disable the button.
    await act(async () => {
      continueBtn.click();
      continueBtn.click();
    });

    expect(mockedPersistRole).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePersist({});
    });
  });

  it('releases the in-flight latch on failure so a retry still calls persistRole', async () => {
    mockedPersistRole.mockRejectedValueOnce(new Error('network error'));
    mockedPersistRole.mockResolvedValueOnce({} as never);

    render(<OnboardingPage />);
    await act(async () => {
      screen.getAllByRole('radio')[0].click();
    });

    const continueBtn = screen.getByRole('button', { name: /continue/i });

    await act(async () => {
      continueBtn.click();
    });
    expect(mockedPersistRole).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await act(async () => {
      continueBtn.click();
    });
    expect(mockedPersistRole).toHaveBeenCalledTimes(2);
  });
});
