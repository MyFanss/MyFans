import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from './page';

// Mock the API
vi.mock('@/lib/api/profile', () => ({
  fetchMe: vi.fn(),
  patchMe: vi.fn(),
  ProfileUnauthorizedError: class extends Error {
    readonly status = 401;
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock ToastContext
vi.mock('@/contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  })),
}));

// Mock UI components
vi.mock('@/components/ui/AvatarUpload', () => ({
  AvatarUpload: () => <div>Avatar Upload</div>,
}));

vi.mock('@/components/ui/Input', () => ({
  Input: ({ label, value, onChange, error }: any) => (
    <div>
      <label>{label}</label>
      <input value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </div>
  ),
}));

vi.mock('@/components/ui/Textarea', () => ({
  Textarea: ({ label, value, onChange, error }: any) => (
    <div>
      <label>{label}</label>
      <textarea value={value} onChange={onChange} />
      {error && <span>{error}</span>}
    </div>
  ),
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load real user profile data from API on mount', async () => {
    const { fetchMe } = await import('@/lib/api/profile');

    const mockUserData = {
      id: 'user-123',
      email: 'user@example.com',
      is_creator: true,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      website_url: 'https://example.com',
      x_handle: '@testuser',
      instagram_handle: '@testuser',
      other_url: null,
      creator: {
        id: 'creator-123',
        bio: 'Test creator bio',
        subscription_price: '9.99',
        currency: 'XLM',
        banner_url: null,
        is_verified: false,
        followers_count: 100,
      },
    };

    (fetchMe as any).mockResolvedValue(mockUserData);

    render(<ProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      expect(fetchMe).toHaveBeenCalled();
    });

    // Verify real data is displayed
    expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
  });

  it('should persist profile changes via API', async () => {
    const { fetchMe, patchMe } = await import('@/lib/api/profile');

    const mockUserData = {
      id: 'user-123',
      email: 'user@example.com',
      is_creator: true,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      website_url: 'https://example.com',
      x_handle: '@testuser',
      instagram_handle: '@testuser',
      other_url: null,
      creator: {
        id: 'creator-123',
        bio: 'Test creator bio',
        subscription_price: '9.99',
        currency: 'XLM',
        banner_url: null,
        is_verified: false,
        followers_count: 100,
      },
    };

    (fetchMe as any).mockResolvedValue(mockUserData);
    (patchMe as any).mockResolvedValue(mockUserData);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    // Change a field
    const displayNameInput = screen.getByDisplayValue('Test User');
    fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } });

    // Click save
    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    // Verify patchMe was called
    await waitFor(() => {
      expect(patchMe).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Updated Name',
        })
      );
    });
  });

  it('should redirect to signin on unauthorized error', async () => {
    const { fetchMe } = await import('@/lib/api/profile');
    const { useRouter } = await import('next/navigation');

    const mockRouter = { push: vi.fn() };
    (useRouter as any).mockReturnValue(mockRouter);

    const ProfileUnauthorizedError = (await import('@/lib/api/profile')).ProfileUnauthorizedError;
    (fetchMe as any).mockRejectedValue(new ProfileUnauthorizedError());

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/signin');
    });
  });

  it('should show error message when profile update fails', async () => {
    const { fetchMe, patchMe } = await import('@/lib/api/profile');
    const { useToast } = await import('@/contexts/ToastContext');

    const mockUserData = {
      id: 'user-123',
      email: 'user@example.com',
      is_creator: true,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      website_url: 'https://example.com',
      x_handle: '@testuser',
      instagram_handle: '@testuser',
      other_url: null,
      creator: {
        id: 'creator-123',
        bio: 'Test creator bio',
        subscription_price: '9.99',
        currency: 'XLM',
        banner_url: null,
        is_verified: false,
        followers_count: 100,
      },
    };

    const mockShowError = vi.fn();
    (useToast as any).mockReturnValue({
      showSuccess: vi.fn(),
      showError: mockShowError,
    });

    (fetchMe as any).mockResolvedValue(mockUserData);
    (patchMe as any).mockRejectedValue(new Error('API error'));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalled();
    });
  });
});
