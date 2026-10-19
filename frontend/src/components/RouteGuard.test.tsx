import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RouteGuard } from './RouteGuard';

const mockReplace = vi.fn();
let mockPathname = '/dashboard/earnings?tab=overview';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

let mockUser: any = null;
let mockLoading = true;

vi.mock('@/context/UserContext', () => ({
  useUser: () => ({ user: mockUser, loading: mockLoading }),
}));

describe('RouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockLoading = false;
    mockPathname = '/dashboard/earnings?tab=overview';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing and does not redirect when loading is true', () => {
    mockLoading = true;
    mockUser = null;

    const { container } = render(
      <RouteGuard>
        <div>Secret Content</div>
      </RouteGuard>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to /auth/sign-in with encoded returnUrl when unauthenticated', () => {
    mockLoading = false;
    mockUser = null;
    mockPathname = '/dashboard/earnings?tab=overview';

    const { container } = render(
      <RouteGuard>
        <div>Secret Content</div>
      </RouteGuard>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
    const expectedUrl = `/auth/sign-in?returnUrl=${encodeURIComponent('/dashboard/earnings?tab=overview')}`;
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(expectedUrl);
  });

  it('redirects fan to /discover and renders no children when requireCreator is true', () => {
    mockLoading = false;
    mockUser = { id: '1', username: 'fan', is_creator: false, email: 'fan@example.com' };
    mockPathname = '/dashboard/earnings';

    const { container } = render(
      <RouteGuard requireCreator={true}>
        <div>Creator Content</div>
      </RouteGuard>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Creator Content')).not.toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/discover');
  });

  it('renders children and does not redirect when creator accesses requireCreator route', () => {
    mockLoading = false;
    mockUser = { id: '2', username: 'creator', is_creator: true, email: 'creator@example.com' };
    mockPathname = '/dashboard/earnings';

    render(
      <RouteGuard requireCreator={true}>
        <div data-testid="creator-content">Creator Content</div>
      </RouteGuard>
    );

    expect(screen.getByTestId('creator-content')).toBeInTheDocument();
    expect(screen.getByText('Creator Content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders children and does not redirect when fan accesses non-creator restricted route (requireCreator=false)', () => {
    mockLoading = false;
    mockUser = { id: '1', username: 'fan', is_creator: false, email: 'fan@example.com' };
    mockPathname = '/discover';

    render(
      <RouteGuard requireCreator={false}>
        <div data-testid="fan-content">Fan Content</div>
      </RouteGuard>
    );

    expect(screen.getByTestId('fan-content')).toBeInTheDocument();
    expect(screen.getByText('Fan Content')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
