import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SubscribersTable from './SubscribersTable';

describe('SubscribersTable mobile behaviors', () => {
  it('renders mobile sort dropdown', () => {
    render(<SubscribersTable />);
    const sortSelect = screen.getByLabelText('Sort by');
    expect(sortSelect).toBeInTheDocument();
  });

  it('mobile sort dropdown has all sort options', () => {
    render(<SubscribersTable />);
    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement;
    
    expect(sortSelect.options.length).toBe(8);
    expect(sortSelect.options[0].value).toBe('joinDate-desc');
    expect(sortSelect.options[1].value).toBe('joinDate-asc');
    expect(sortSelect.options[2].value).toBe('name-asc');
    expect(sortSelect.options[3].value).toBe('name-desc');
    expect(sortSelect.options[4].value).toBe('totalPaid-desc');
    expect(sortSelect.options[5].value).toBe('totalPaid-asc');
    expect(sortSelect.options[6].value).toBe('status-asc');
    expect(sortSelect.options[7].value).toBe('plan-asc');
  });

  it('changes sort when mobile dropdown selection changes', () => {
    render(<SubscribersTable />);
    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement;
    
    fireEvent.change(sortSelect, { target: { value: 'name-asc' } });
    expect(sortSelect.value).toBe('name-asc');
    
    fireEvent.change(sortSelect, { target: { value: 'totalPaid-desc' } });
    expect(sortSelect.value).toBe('totalPaid-desc');
  });

  it('renders mobile card view for subscribers', () => {
    render(<SubscribersTable />);
    // Mobile cards should be present (they use specific mobile-only classes)
    const mobileCards = document.querySelectorAll('.md\\:hidden .p-4');
    expect(mobileCards.length).toBeGreaterThan(0);
  });

  it('mobile pagination buttons have proper touch target size', () => {
    render(<SubscribersTable />);
    const prevButton = screen.getByLabelText('Previous Page');
    const nextButton = screen.getByLabelText('Next Page');
    
    expect(prevButton).toHaveClass('min-w-[44px]', 'min-h-[44px]');
    expect(nextButton).toHaveClass('min-w-[44px]', 'min-h-[44px]');
  });

  it('search input has proper mobile touch target', () => {
    render(<SubscribersTable />);
    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    expect(searchInput).toHaveClass('min-h-[44px]');
  });

  it('status filter dropdown has proper mobile touch target', () => {
    render(<SubscribersTable />);
    const statusFilter = screen.getByDisplayValue('All Statuses');
    expect(statusFilter).toHaveClass('min-h-[44px]');
  });

  it('export button has proper mobile touch target', () => {
    render(<SubscribersTable />);
    const exportButton = screen.getByText('Export CSV');
    expect(exportButton).toHaveClass('min-h-[44px]');
  });
});
