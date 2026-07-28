"use client";

import { useCallback, useEffect, useState } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Pagination } from "@/components/transactions/Pagination";
import { getAuthHeaders } from "@/lib/api-utils";
import type { Transaction, TransactionsResponse } from "@/lib/transactions";

interface Filters {
  type?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  creator?: string;
}

export default function TransactionsPage() {
  const [data, setData] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
    });
    if (filters.creator) params.set("creator", filters.creator);
    if (filters.fromDate) params.set("from", filters.fromDate);
    if (filters.toDate) params.set("to", filters.toDate);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);

    try {
      const res = await fetch(`/api/transactions?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: getAuthHeaders(),
      });

      const json = (await res.json().catch(() => ({}))) as TransactionsResponse & {
        message?: string;
      };

      if (!res.ok) {
        throw new Error(json.message || `Failed to fetch transactions (${res.status})`);
      }

      setData(Array.isArray(json.data) ? json.data : []);
      setTotalPages(json.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transactions");
      setData([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Transaction History</h1>

      <TransactionFilters filters={filters} setFilters={setFilters} />

      <TransactionTable data={data} isLoading={isLoading} error={error} />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
