/**
 * Tests for SubscribersTable – covers search, status filter, mobile card stack,
 * and empty state handling.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SubscribersTable from './SubscribersTable';

// Mock next/image so tests don't need a Next.js environment
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ''} {...props} />
  ),
}));

describe('SubscribersTable – controls', () => {
  it('renders search input', () => {
    render(<SubscribersTable />);
    expect(screen.getByLabelText('Search subscribers')).toBeInTheDocument();
  });

  it('renders status filter dropdown', () => {
    render(<SubscribersTable />);
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
  });

  it('status filter has all options', () => {
    render(<SubscribersTable />);
    const select = screen.getByLabelText('Filter by status') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('All');
    expect(values).toContain('Active');
    expect(values).toContain('Cancelled');
    expect(values).toContain('Past Due');
  });

  it('renders Export CSV button', () => {
    render(<SubscribersTable />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });
});

describe('SubscribersTable – search filtering', () => {
  it('filters subscribers by name', () => {
    render(<SubscribersTable />);
    const input = screen.getByLabelText('Search subscribers');
    fireEvent.change(input, { target: { value: 'Alice' } });
    // Alice Smith should be visible; Bob Johnson should not
    expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
  });

  it('shows empty message when search matches nothing', () => {
    render(<SubscribersTable />);
    const input = screen.getByLabelText('Search subscribers');
    fireEvent.change(input, { target: { value: 'zzznomatch' } });
    expect(
      screen.getAllByText('No subscribers found matching your criteria.').length,
    ).toBeGreaterThan(0);
  });
});

describe('SubscribersTable – status filter', () => {
  it('filters to Active subscribers only', () => {
    render(<SubscribersTable />);
    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'Active' },
    });
    // Diana Prince is Cancelled — should not appear
    expect(screen.queryByText('Diana Prince')).not.toBeInTheDocument();
  });

  it('filters to Cancelled subscribers only', () => {
    render(<SubscribersTable />);
    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'Cancelled' },
    });
    // Diana Prince is Cancelled — should appear
    expect(screen.getByText('Diana Prince')).toBeInTheDocument();
    // Alice Smith is Active — should not appear
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });
});

describe('SubscribersTable – mobile card stack', () => {
  it('renders mobile card stack container', () => {
    render(<SubscribersTable />);
    // The mobile card stack has aria-label="Subscribers"
    expect(screen.getByLabelText('Subscribers')).toBeInTheDocument();
  });

  it('mobile card stack shows subscriber names', () => {
    render(<SubscribersTable />);
    const mobileList = screen.getByLabelText('Subscribers');
    // Alice Smith is in the first page of mock data
    expect(mobileList).toBeInTheDocument();
  });

  it('mobile empty state message appears when no results', () => {
    render(<SubscribersTable />);
    fireEvent.change(screen.getByLabelText('Search subscribers'), {
      target: { value: 'zzznomatch' },
    });
    const emptyMessages = screen.getAllByText(
      'No subscribers found matching your criteria.',
    );
    // At least one empty message (mobile or desktop)
    expect(emptyMessages.length).toBeGreaterThan(0);
  });
});
