import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import * as logger from '@/lib/logger';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), back: jest.fn(), push: jest.fn() }),
}));

// Minimal stub so ErrorFallback renders without crashing in jsdom
jest.mock('@/components/ErrorFallback', () => ({
  ErrorFallback: ({ error, onReset }: { error: { message: string; actions?: { label: string; primary?: boolean; type: string }[] }; onReset?: () => void }) => (
    <div role="alert">
      <p>{error.message}</p>
      {onReset && <button onClick={onReset}>Try again</button>}
    </div>
  ),
}));

// ─── Root error.tsx ───────────────────────────────────────────────────────────

describe('ErrorPage (app/error.tsx)', () => {
  let ErrorPage: React.ComponentType<{ error: Error & { digest?: string }; reset: () => void }>;

  beforeAll(async () => {
    const mod = await import('../error');
    ErrorPage = mod.default;
  });

  beforeEach(() => jest.spyOn(logger, 'logError').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('renders the error message', () => {
    const error = Object.assign(new Error('Something broke'), { digest: 'abc123' });
    render(<ErrorPage error={error} reset={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('calls logError with the digest as correlationId', () => {
    const logSpy = jest.spyOn(logger, 'logError').mockImplementation(() => {});
    const error = Object.assign(new Error('Oops'), { digest: 'corr-99' });
    render(<ErrorPage error={error} reset={() => {}} />);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'corr-99' })
    );
  });

  it('calls reset when Try again is clicked', () => {
    const reset = jest.fn();
    const error = new Error('Click test');
    render(<ErrorPage error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('logs even when digest is undefined', () => {
    const logSpy = jest.spyOn(logger, 'logError').mockImplementation(() => {});
    const error = new Error('No digest');
    render(<ErrorPage error={error} reset={() => {}} />);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No digest' })
    );
  });
});

// ─── global-error.tsx ─────────────────────────────────────────────────────────

describe('GlobalErrorPage (app/global-error.tsx)', () => {
  let GlobalErrorPage: React.ComponentType<{ error: Error & { digest?: string }; reset: () => void }>;

  beforeAll(async () => {
    const mod = await import('../global-error');
    GlobalErrorPage = mod.default;
  });

  beforeEach(() => jest.spyOn(logger, 'logError').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('renders heading and actions', () => {
    const error = new Error('Global crash');
    render(<GlobalErrorPage error={error} reset={() => {}} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByText('Go home')).toBeInTheDocument();
  });

  it('shows correlation ID when digest is present', () => {
    const error = Object.assign(new Error('With digest'), { digest: 'ref-42' });
    render(<GlobalErrorPage error={error} reset={() => {}} />);
    expect(screen.getByTestId('correlation-id')).toHaveTextContent('ref-42');
  });

  it('does not show correlation ID element when digest is absent', () => {
    const error = new Error('No digest');
    render(<GlobalErrorPage error={error} reset={() => {}} />);
    expect(screen.queryByTestId('correlation-id')).not.toBeInTheDocument();
  });

  it('calls logError with correlationId from digest', () => {
    const logSpy = jest.spyOn(logger, 'logError').mockImplementation(() => {});
    const error = Object.assign(new Error('Global'), { digest: 'g-001' });
    render(<GlobalErrorPage error={error} reset={() => {}} />);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'g-001' })
    );
  });

  it('calls reset when Try again is clicked', () => {
    const reset = jest.fn();
    const error = new Error('Reset test');
    render(<GlobalErrorPage error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
