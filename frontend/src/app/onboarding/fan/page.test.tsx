/**
 * Regression coverage for #2012: handleGetStarted must guard against
 * duplicate persistRole('fan') calls when the button is clicked (or
 * Enter-pressed) more than once before the first request settles.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FanOnboardingPage from './page';

const persistRole = vi.fn();
vi.mock('@/lib/users-api', () => ({
  persistRole: (...args: unknown[]) => persistRole(...args),
}));

const refreshUser = vi.fn();
vi.mock('@/context/UserContext', () => ({
  useUser: () => ({ user: null, loading: false, refreshUser }),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('FanOnboardingPage — duplicate-click guard (#2012)', () => {
  beforeEach(() => {
    persistRole.mockReset();
    refreshUser.mockReset();
    replace.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calling handleGetStarted twice before the first resolves issues exactly one persistRole call', async () => {
    let resolvePersist!: (user: unknown) => void;
    persistRole.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePersist = resolve;
        }),
    );
    refreshUser.mockResolvedValue(undefined);

    render(<FanOnboardingPage />);
    const button = screen.getByRole('button', { name: /get started as a fan/i });

    // Two rapid clicks before the first request settles.
    fireEvent.click(button);
    fireEvent.click(button);

    expect(persistRole).toHaveBeenCalledTimes(1);
    expect(persistRole).toHaveBeenCalledWith('fan');

    resolvePersist({ id: 'u1', isCreator: false });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/discover'));
    expect(persistRole).toHaveBeenCalledTimes(1);
  });

  it('keeps the button disabled and aria-busy for the duration of the request', async () => {
    let resolvePersist!: (user: unknown) => void;
    persistRole.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePersist = resolve;
        }),
    );
    refreshUser.mockResolvedValue(undefined);

    render(<FanOnboardingPage />);
    const button = screen.getByRole('button', { name: /get started as a fan/i });

    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button.getAttribute('aria-busy')).toBe('true');

    resolvePersist({ id: 'u1', isCreator: false });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/discover'));
  });

  it('redirects to /discover exactly once on success', async () => {
    persistRole.mockResolvedValue({ id: 'u1', isCreator: false });
    refreshUser.mockResolvedValue(undefined);

    render(<FanOnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: /get started as a fan/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith('/discover');
  });

  it('shows the error and resets the in-flight guard so a retry is possible', async () => {
    persistRole.mockRejectedValueOnce(new Error('network blip'));
    persistRole.mockResolvedValueOnce({ id: 'u1', isCreator: false });
    refreshUser.mockResolvedValue(undefined);

    render(<FanOnboardingPage />);
    const button = screen.getByRole('button', { name: /get started as a fan/i });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('network blip'));

    // The guard must have reset after the failure so a second click retries.
    fireEvent.click(screen.getByRole('button', { name: /get started as a fan/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/discover'));
    expect(persistRole).toHaveBeenCalledTimes(2);
  });
});
