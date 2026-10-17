import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UserProvider, useUser } from './UserContext';

vi.mock('@/lib/users-api');
import { fetchMe } from '@/lib/users-api';
const mockedFetchMe = vi.mocked(fetchMe);

function Probe() {
  const { user, loading, refreshUser } = useUser();
  return (
    <div>
      <span data-testid="user">{user ? user.username : 'null'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button onClick={() => refreshUser()}>refresh</button>
    </div>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('UserContext', () => {
  it('calls fetchMe on mount and transitions loading true→false', async () => {
    let resolve!: (v: unknown) => void;
    mockedFetchMe.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<UserProvider><Probe /></UserProvider>);
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(mockedFetchMe).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ id: '1', username: 'alice', email: 'a@b.com' }));
    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user').textContent).toBe('alice');
  });

  it('sets user null and loading false when fetchMe rejects', async () => {
    mockedFetchMe.mockRejectedValue(new Error('fail'));
    render(<UserProvider><Probe /></UserProvider>);
    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('re-invokes fetchMe on manual refresh and updates user', async () => {
    mockedFetchMe.mockResolvedValue({ id: '1', username: 'alice', email: 'a@b.com' });
    render(<UserProvider><Probe /></UserProvider>);
    expect(await screen.findByTestId('user')).toHaveTextContent('alice');
    mockedFetchMe.mockResolvedValue({ id: '2', username: 'bob', email: 'b@c.com' });
    await act(async () => { screen.getByText('refresh').click(); });
    expect(await screen.findByTestId('user')).toHaveTextContent('bob');
    expect(mockedFetchMe).toHaveBeenCalledTimes(2);
  });
});
