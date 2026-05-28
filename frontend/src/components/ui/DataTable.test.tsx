import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable, ColumnDef } from './DataTable';

interface Row { id: string; name: string; score: number }

const COLUMNS: ColumnDef<Row, 'name' | 'score'>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'score', header: 'Score', sortable: true },
];

const DATA: Row[] = [
  { id: '1', name: 'Alice', score: 80 },
  { id: '2', name: 'Charlie', score: 50 },
  { id: '3', name: 'Bob', score: 95 },
];

const keyExtractor = (r: Row) => r.id;

describe('DataTable', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders column headers', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('renders all rows', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('uses custom render function', () => {
    const cols: ColumnDef<Row, 'name' | 'score'>[] = [
      { key: 'name', header: 'Name', render: (r) => <strong data-testid="custom">{r.name}!</strong> },
      { key: 'score', header: 'Score' },
    ];
    render(<DataTable columns={cols} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    expect(screen.getAllByTestId('custom')).toHaveLength(3);
  });

  // ── Empty / Loading / Error states ─────────────────────────────────────────

  it('shows empty message when data is empty', () => {
    render(<DataTable columns={COLUMNS} data={[]} keyExtractor={keyExtractor} emptyMessage="Nothing here." />);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('shows default empty message', () => {
    render(<DataTable columns={COLUMNS} data={[]} keyExtractor={keyExtractor} />);
    expect(screen.getByText('No data found.')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading=true', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={[]} keyExtractor={keyExtractor} isLoading />);
    // TableSkeleton renders divs, not a table
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows error alert when error is provided', () => {
    render(<DataTable columns={COLUMNS} data={[]} keyExtractor={keyExtractor} error="Something went wrong." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
  });

  it('does not render table when error is set', () => {
    const { container } = render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} error="Oops" />);
    expect(container.querySelector('table')).toBeNull();
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  it('sorts ascending on first click', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    const cells = screen.getAllByRole('cell').filter((_, i) => i % 2 === 0); // name column cells
    expect(cells[0]).toHaveTextContent('Alice');
    expect(cells[1]).toHaveTextContent('Bob');
    expect(cells[2]).toHaveTextContent('Charlie');
  });

  it('sorts descending on second click', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    const nameBtn = screen.getByRole('button', { name: /name/i });
    fireEvent.click(nameBtn);
    fireEvent.click(nameBtn);
    const cells = screen.getAllByRole('cell').filter((_, i) => i % 2 === 0);
    expect(cells[0]).toHaveTextContent('Charlie');
  });

  it('sets aria-sort on active column', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    const nameHeader = screen.getByRole('button', { name: /name/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(nameHeader);
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(nameHeader);
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('calls onSortChange when controlled', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        keyExtractor={keyExtractor}
        sort={{ key: null, direction: 'asc' }}
        onSortChange={onSortChange}
        pageSize={10}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /score/i }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'score', direction: 'asc' });
  });

  // ── Keyboard accessibility ─────────────────────────────────────────────────

  it('triggers sort on Enter key', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    const nameBtn = screen.getByRole('button', { name: /name/i });
    fireEvent.keyDown(nameBtn, { key: 'Enter' });
    expect(nameBtn).toHaveAttribute('aria-sort', 'ascending');
  });

  it('triggers sort on Space key', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    const nameBtn = screen.getByRole('button', { name: /name/i });
    fireEvent.keyDown(nameBtn, { key: ' ' });
    expect(nameBtn).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sortable headers have tabIndex=0', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} />);
    const nameBtn = screen.getByRole('button', { name: /name/i });
    expect(nameBtn).toHaveAttribute('tabindex', '0');
  });

  it('non-sortable headers have no tabIndex', () => {
    const cols: ColumnDef<Row, 'name' | 'score'>[] = [
      { key: 'name', header: 'Name', sortable: false },
      { key: 'score', header: 'Score' },
    ];
    render(<DataTable columns={cols} data={DATA} keyExtractor={keyExtractor} />);
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).not.toHaveAttribute('tabindex');
  });

  it('pagination buttons are keyboard accessible', () => {
    const manyRows = Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(<DataTable columns={COLUMNS} data={manyRows} keyExtractor={keyExtractor} pageSize={5} />);
    const nav = screen.getByRole('navigation', { name: /pagination/i });
    const buttons = within(nav).getAllByRole('button');
    buttons.forEach((btn) => expect(btn).not.toHaveAttribute('tabindex', '-1'));
  });

  // ── Pagination ─────────────────────────────────────────────────────────────

  it('paginates data correctly', () => {
    const manyRows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(<DataTable columns={COLUMNS} data={manyRows} keyExtractor={keyExtractor} pageSize={3} />);
    expect(screen.getByText('User 0')).toBeInTheDocument();
    expect(screen.queryByText('User 3')).not.toBeInTheDocument();
  });

  it('navigates to next page', () => {
    const manyRows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(<DataTable columns={COLUMNS} data={manyRows} keyExtractor={keyExtractor} pageSize={3} />);
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('User 3')).toBeInTheDocument();
    expect(screen.queryByText('User 0')).not.toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    const manyRows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(<DataTable columns={COLUMNS} data={manyRows} keyExtractor={keyExtractor} pageSize={3} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('disables next button on last page', () => {
    const manyRows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(<DataTable columns={COLUMNS} data={manyRows} keyExtractor={keyExtractor} pageSize={3} />);
    fireEvent.click(screen.getByRole('button', { name: /page 3/i }));
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('calls onPageChange when controlled', () => {
    const onPageChange = vi.fn();
    const manyRows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(
      <DataTable
        columns={COLUMNS}
        data={manyRows}
        keyExtractor={keyExtractor}
        page={1}
        onPageChange={onPageChange}
        pageSize={3}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('shows pagination range text', () => {
    const manyRows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: `User ${i}`, score: i }));
    render(<DataTable columns={COLUMNS} data={manyRows} keyExtractor={keyExtractor} pageSize={3} />);
    expect(screen.getByText(/1–3/)).toBeInTheDocument();
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it('does not render pagination when all data fits one page', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} pageSize={10} />);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });

  // ── Caption / aria-label ───────────────────────────────────────────────────

  it('applies caption as aria-label on table', () => {
    render(<DataTable columns={COLUMNS} data={DATA} keyExtractor={keyExtractor} caption="My Table" />);
    expect(screen.getByRole('table', { name: 'My Table' })).toBeInTheDocument();
  });
});
