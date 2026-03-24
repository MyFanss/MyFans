import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import * as logger from '@/lib/logger';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), back: jest.fn(), push: jest.fn() }),
}));

// ─── dashboard/error.tsx ──────────────────────────────────────────────────────

describe('DashboardErrorPage (app/dashboard/error.tsx)', () => {
  let DashboardErrorPage: React.ComponentType<{
    error: Error & { digest?: string };
    reset: () => void;
  }>;

  beforeAll(async () => {
    const mod = await import('../dashboard/error');
    DashboardErrorPage = mod.default;
  });

  beforeEach(() => jest.spyOn(logger, 'logError').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('renders heading and recovery actions', () => {
    const error = new Error('Dashboard broke');
    render(<DashboardErrorPage error={error} reset={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Dashboard error')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByText('Dashboard home')).toBeInTheDocument();
  });

  it('shows correlation ID when digest is present', () => {
    const error = Object.assign(new Error('Dash error'), { digest: 'dash-42' });
    render(<DashboardErrorPage error={error} reset={() => {}} />);
    expect(screen.getByTestId('correlation-id')).toHaveTextContent('dash-42');
  });

  it('does not show correlation ID when digest is absent', () => {
    const error = new Error('No digest');
    render(<DashboardErrorPage error={error} reset={() => {}} />);
    expect(screen.queryByTestId('correlation-id')).not.toBeInTheDocument();
  });

  it('calls logError with segment=dashboard and correlationId', () => {
    const logSpy = jest.spyOn(logger, 'logError').mockImplementation(() => {});
    const error = Object.assign(new Error('Logged'), { digest: 'd-001' });
    render(<DashboardErrorPage error={error} reset={() => {}} />);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'd-001',
        context: expect.objectContaining({ segment: 'dashboard' }),
      })
    );
  });

  it('calls reset when Try again is clicked', () => {
    const reset = jest.fn();
    const error = new Error('Reset');
    render(<DashboardErrorPage error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

// ─── creator/[username]/error.tsx ─────────────────────────────────────────────

describe('CreatorErrorPage (app/creator/[username]/error.tsx)', () => {
  let CreatorErrorPage: React.ComponentType<{
    error: Error & { digest?: string };
    reset: () => void;
  }>;

  beforeAll(async () => {
    const mod = await import('../creator/[username]/error');
    CreatorErrorPage = mod.default;
  });

  beforeEach(() => jest.spyOn(logger, 'logError').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('renders heading and recovery actions', () => {
    const error = new Error('Creator broke');
    render(<CreatorErrorPage error={error} reset={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not load creator')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByText('Browse creators')).toBeInTheDocument();
  });

  it('shows correlation ID when digest is present', () => {
    const error = Object.assign(new Error('Creator error'), { digest: 'cr-99' });
    render(<CreatorErrorPage error={error} reset={() => {}} />);
    expect(screen.getByTestId('correlation-id')).toHaveTextContent('cr-99');
  });

  it('does not show correlation ID when digest is absent', () => {
    const error = new Error('No digest');
    render(<CreatorErrorPage error={error} reset={() => {}} />);
    expect(screen.queryByTestId('correlation-id')).not.toBeInTheDocument();
  });

  it('calls logError with segment=creator and correlationId', () => {
    const logSpy = jest.spyOn(logger, 'logError').mockImplementation(() => {});
    const error = Object.assign(new Error('Logged'), { digest: 'c-002' });
    render(<CreatorErrorPage error={error} reset={() => {}} />);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'c-002',
        context: expect.objectContaining({ segment: 'creator' }),
      })
    );
  });

  it('calls reset when Try again is clicked', () => {
    const reset = jest.fn();
    const error = new Error('Reset');
    render(<CreatorErrorPage error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
