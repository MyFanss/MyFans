import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchMe,
  patchMe,
  ProfileUnauthorizedError,
} from './profile';

vi.mock('@/lib/api/base-url', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

global.fetch = vi.fn() as unknown as typeof fetch;

describe('profile API auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('sends JWT Bearer token, not a raw user id', async () => {
    localStorage.setItem('authToken', 'jwt-access-token');
    localStorage.setItem('myfans_user_id', 'user-uuid-123');

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: 'user-uuid-123', email: 'a@b.c' }),
    });

    await fetchMe();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/users/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-access-token',
        }),
      }),
    );

    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).not.toContain('user-uuid-123');
    expect(headers['X-User-Id']).toBeUndefined();
  });

  it('throws ProfileUnauthorizedError and clears token on 401', async () => {
    localStorage.setItem('authToken', 'expired-jwt');

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    });

    await expect(fetchMe()).rejects.toBeInstanceOf(ProfileUnauthorizedError);
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('sends JWT on PATCH /users/me', async () => {
    localStorage.setItem('authToken', 'jwt-patch');

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ id: '1' }),
    });

    await patchMe({ display_name: 'Ada' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/users/me',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-patch',
        }),
      }),
    );
  });
});
