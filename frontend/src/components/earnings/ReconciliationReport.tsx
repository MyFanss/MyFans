'use client';

import React, { useEffect, useState } from 'react';
import { BaseCard } from '@/components/cards';
import { fetchReconciliationReport, type ReconciliationRow } from '@/lib/earnings-api';
import { reconciliationToCSV, downloadCSV } from '@/lib/earnings-export';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function ReconciliationReport() {
  const [from, setFrom] = useState(thirtyDaysAgoISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchReconciliationReport({ from, to, page, limit });
        if (!cancelled) {
          setRows(res.data);
          setTotal(res.total);
          setTotalPages(res.total_pages);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [from, to, page]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const allRows: ReconciliationRow[] = [];
      let p = 1;
      let tp = 1;
      do {
        const res = await fetchReconciliationReport({ from, to, page: p, limit: 100 });
        allRows.push(...res.data);
        tp = res.total_pages;
        p++;
      } while (p <= tp);
      const csv = reconciliationToCSV(allRows);
      downloadCSV(csv, `reconciliation-${from}-to-${to}.csv`);
    } catch {
      // user can retry
    } finally {
      setExporting(false);
    }
  };

  return (
    <BaseCard padding="lg" as="section" aria-labelledby="reconciliation-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 id="reconciliation-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          Earnings Reconciliation
        </h2>
        <button
          onClick={handleExport}
          disabled={exporting || rows.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Export reconciliation report as CSV"
        >
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      {/* Date range filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
          />
        </label>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No earnings data for this period.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Earnings reconciliation table">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Creator', 'Asset', 'Gross', 'Protocol Fees', 'Net', 'Payments'].map((h) => (
                    <th key={h} className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.creator}-${row.asset}-${i}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-2 font-mono text-xs text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={row.creator}>
                      {row.creator}
                    </td>
                    <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">{row.asset}</td>
                    <td className="py-3 px-2 text-gray-900 dark:text-white">{row.totalGross}</td>
                    <td className="py-3 px-2 text-red-600 dark:text-red-400">{row.totalFees}</td>
                    <td className="py-3 px-2 text-green-700 dark:text-green-400 font-semibold">{row.totalNet}</td>
                    <td className="py-3 px-2 text-gray-600 dark:text-gray-400">{row.paymentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 gap-3 sm:gap-0">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages} · {total} creator{total !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </>
      )}
    </BaseCard>
  );
}
