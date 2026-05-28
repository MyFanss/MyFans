'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { TableSkeleton } from './states';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

export interface ColumnDef<T, K extends string = string> {
  key: K;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T, K extends string = string> {
  columns: ColumnDef<T, K>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  pageSize?: number;
  /** Controlled sort — pass to manage externally */
  sort?: SortState<K>;
  onSortChange?: (sort: SortState<K>) => void;
  /** Controlled page — pass to manage externally */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Total items count for controlled/server-side pagination */
  totalItems?: number;
  caption?: string;
  className?: string;
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden />;
  return direction === 'asc'
    ? <ArrowUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden />
    : <ArrowDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden />;
}

export function DataTable<T, K extends string = string>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  error = null,
  emptyMessage = 'No data found.',
  pageSize = 10,
  sort: controlledSort,
  onSortChange,
  page: controlledPage,
  onPageChange,
  totalItems,
  caption,
  className = '',
}: DataTableProps<T, K>) {
  const [internalSort, setInternalSort] = useState<SortState<K>>({ key: null, direction: 'asc' });
  const [internalPage, setInternalPage] = useState(1);

  const isControlledSort = controlledSort !== undefined;
  const isControlledPage = controlledPage !== undefined;

  const sort = isControlledSort ? controlledSort : internalSort;
  const currentPage = isControlledPage ? controlledPage : internalPage;

  const handleSort = useCallback((key: K) => {
    const next: SortState<K> = {
      key,
      direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc',
    };
    if (isControlledSort) onSortChange?.(next);
    else setInternalSort(next);
    // Reset to page 1 on sort
    if (!isControlledPage) setInternalPage(1);
    else onPageChange?.(1);
  }, [sort, isControlledSort, isControlledPage, onSortChange, onPageChange]);

  const handlePageChange = useCallback((page: number) => {
    if (isControlledPage) onPageChange?.(page);
    else setInternalPage(page);
  }, [isControlledPage, onPageChange]);

  // Client-side sort (skipped when server-side — caller provides pre-sorted data)
  const sortedData = useMemo(() => {
    if (!sort.key || isControlledSort) return data;
    const key = sort.key;
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sort, isControlledSort]);

  // Client-side pagination (skipped when server-side — caller provides pre-paged data)
  const total = totalItems ?? sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedData = isControlledPage ? sortedData : sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  if (isLoading) {
    return <TableSkeleton rows={pageSize > 8 ? 5 : pageSize} />;
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-6 text-center text-sm text-red-700 dark:text-red-400"
      >
        {error}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400" aria-label={caption}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 font-semibold ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500' : ''} ${col.headerClassName ?? ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  onKeyDown={col.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key); } } : undefined}
                  tabIndex={col.sortable ? 0 : undefined}
                  role={col.sortable ? 'button' : undefined}
                  aria-sort={
                    col.sortable && sort.key === col.key
                      ? sort.direction === 'asc' ? 'ascending' : 'descending'
                      : col.sortable ? 'none' : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <SortIcon active={sort.key === col.key} direction={sort.direction} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedData.map((row, idx) => (
                <tr
                  key={keyExtractor(row)}
                  className={`${idx < pagedData.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 gap-2 sm:gap-0">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {total === 0 ? 'No results' : (
              <>Showing <strong className="text-gray-900 dark:text-white">{from}–{to}</strong> of <strong className="text-gray-900 dark:text-white">{total}</strong></>
            )}
          </span>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
              className="p-1.5 rounded-md text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === currentPage ? 'page' : undefined}
                className={`min-w-[2rem] h-8 px-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  p === currentPage
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
              className="p-1.5 rounded-md text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

export default DataTable;
