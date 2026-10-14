import { render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserProvider, useUser } from './UserContext';
import { fetchMe, type User } from '@/lib/users-api';

vi.mock('@/lib/users-api', () => ({
  fetchMe: vi.fn(),
}));

const mockFetchMe = vi.mocked(fetchMe);

const mockUser: User = {
  id: 'user-123',
  publicKey: 'GBAD5234567234567234567234567234567234567234567234567231',
  username: 'alice',
  displayName: 'Alice In Wonderland',
  avatarUrl: 'https://example.com/avatar.png',
  is_creator: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function Probe() {
  const { user, loading, refreshUser } = useUser();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'idle'}</div>
      <div data-testid="user">{user ? user.username : 'no-user'}</div>
      <button onClick={() => void refreshUser()} data-testid="refresh">
        Refresh
      </button>
    </div>
  );
}

describe('UserContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls fetchMe on mount and transitions loading from true to false', async () => {
    let resolvePromise: (value: User | null) => void;
    const promise = new Promise<User | null>((resolve) => {
      resolvePromise = resolve;
    });
    mockFetchMe.mockReturnValue(promise);

    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(mockFetchMe).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePromise!(mockUser);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('alice');
  });

  it('sets user to the resolved value on success', async () => {
    mockFetchMe.mockResolvedValue(mockUser);

    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(mockFetchMe).toHaveBeenCalledTimes(1);
  });

  it('leaves user null and loading false without throwing when fetchMe rejects', async () => {
    mockFetchMe.mockRejectedValue(new Error('Network error'));

    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(mockFetchMe).toHaveBeenCalledTimes(1);
  });

  it('re-invokes fetchMe and updates user when refreshUser is called', async () => {
    mockFetchMe.mockResolvedValue(mockUser);

    render(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(mockFetchMe).toHaveBeenCalledTimes(1);

    const updatedUser: User = {
      ...mockUser,
      username: 'bob',
    };
    mockFetchMe.mockResolvedValue(updatedUser);

    await act(async () => {
      screen.getByTestId('refresh').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('bob');
    });
    expect(mockFetchMe).toHaveBeenCalledTimes(2);
  });
});
