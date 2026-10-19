/**
 * Unit tests for the sign-in page's post-auth redirect.
 *
 * Issue #2008: handleConnect must derive the redirect destination from the
 * UserContext user that refreshUser() already fetched, not from a second,
 * unguarded /users/me request.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInPage from './page';

vi.mock('@/lib/auth-storage', () => ({
  setAuthToken: vi.fn(),
}));

const mockReplace = vi.fn();
const mockGet = vi.fn((key: string) => (key === 'returnUrl' ? null : null));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: mockGet }),
}));

let mockUser: { is_creator: boolean } | null = null;
const mockRefreshUser = vi.fn(async () => mockUser);
vi.mock('@/context/UserContext', () => ({
  useUser: () => ({ user: null, loading: false, refreshUser: mockRefreshUser }),
}));

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('SignInPage handleConnect', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('redirects a creator to /dashboard using the refreshed context user, with no second /users/me fetch', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'jwt-abc' }));
    mockUser = { is_creator: true };

    render(<SignInPage />);
    await user.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    // Exactly one fetch: the wallet-auth POST. No follow-up /users/me call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects a fan to /discover using the refreshed context user', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'jwt-abc' }));
    mockUser = { is_creator: false };

    render(<SignInPage />);
    await user.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    expect(mockReplace).toHaveBeenCalledWith('/discover');
  });

  it('prefers a safe returnUrl over the role-based destination', async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((key: string) => (key === 'returnUrl' ? '/settings' : null));
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'jwt-abc' }));
    mockUser = { is_creator: true };

    render(<SignInPage />);
    await user.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });

  it('shows an error instead of redirecting when refreshUser yields no user', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'jwt-abc' }));
    mockUser = null;

    render(<SignInPage />);
    await user.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
