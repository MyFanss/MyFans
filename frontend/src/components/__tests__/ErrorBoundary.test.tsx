import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const mockLogError = jest.fn();
jest.mock('@/lib/logger', () => ({ logError: (...args: unknown[]) => mockLogError(...args) }));

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockLogError.mockClear();
});
afterEach(() => jest.restoreAllMocks());

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>Safe content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Safe content')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('resets error state when reset button is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const retryBtn = screen.getAllByRole('button').find(
      (b) => /try|retry/i.test(b.textContent ?? '')
    );
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn!);

    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('calls onError callback when a child throws', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [appError] = onError.mock.calls[0];
    expect(appError.code).toBeDefined();
    expect(appError.message).toBe('Test explosion');
  });

  it('logs the error via logError with a message', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError.mock.calls[0][0].message).toContain('Test explosion');
  });

  it('hides reset button when showReset is false', () => {
    render(
      <ErrorBoundary showReset={false}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
