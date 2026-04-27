import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardSectionBoundary } from './DashboardSectionBoundary';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}));

const originalConsoleError = console.error;
beforeEach(() => { console.error = vi.fn(); });
afterEach(() => { console.error = originalConsoleError; });

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('section boom');
  return <div>section content</div>;
}

describe('DashboardSectionBoundary', () => {
  it('renders children when no error', () => {
    render(
      <DashboardSectionBoundary>
        <Bomb shouldThrow={false} />
      </DashboardSectionBoundary>
    );
    expect(screen.getByText('section content')).toBeTruthy();
  });

  it('shows compact fallback when child throws', () => {
    render(
      <DashboardSectionBoundary>
        <Bomb shouldThrow={true} />
      </DashboardSectionBoundary>
    );
    expect(screen.queryByText('section content')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('includes the section label in the fallback message', () => {
    render(
      <DashboardSectionBoundary label="Metrics">
        <Bomb shouldThrow={true} />
      </DashboardSectionBoundary>
    );
    expect(screen.getByText(/Metrics failed to load/i)).toBeTruthy();
  });

  it('uses default label when none provided', () => {
    render(
      <DashboardSectionBoundary>
        <Bomb shouldThrow={true} />
      </DashboardSectionBoundary>
    );
    expect(screen.getByText(/This section failed to load/i)).toBeTruthy();
  });

  it('calls onReset when Retry is clicked', () => {
    const onReset = vi.fn();
    render(
      <DashboardSectionBoundary onReset={onReset}>
        <Bomb shouldThrow={true} />
      </DashboardSectionBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('isolates errors — sibling section still renders', () => {
    render(
      <div>
        <DashboardSectionBoundary label="Broken">
          <Bomb shouldThrow={true} />
        </DashboardSectionBoundary>
        <DashboardSectionBoundary label="Healthy">
          <Bomb shouldThrow={false} />
        </DashboardSectionBoundary>
      </div>
    );
    expect(screen.getByText(/Broken failed to load/i)).toBeTruthy();
    expect(screen.getByText('section content')).toBeTruthy();
  });
});
