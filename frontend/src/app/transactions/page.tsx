"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/clients/api-client";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Pagination } from "@/components/transactions/Pagination";
import type { PaymentRecord } from "@/types";

interface Transaction {
    id: string;
    type: "subscription" | "payment" | "refund";
    status: "pending" | "success" | "failed";
    amount: number;
    currency: string;
    txHash?: string;
    createdAt: string;
}

function mapPaymentToTransaction(payment: PaymentRecord): Transaction {
    return {
        id: payment.id,
        type: "payment",
        status: (payment.status as "completed" | "pending" | "failed" | "refunded") === "completed"
            ? "success"
            : payment.status === "pending"
            ? "pending"
            : "failed",
        amount: payment.amount,
        currency: payment.currency,
        txHash: payment.txHash,
        createdAt: payment.date,
    };
}

export default function TransactionsPage() {
    const [data, setData] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchTransactions();
    }, [filters, page]);

    async function fetchTransactions() {
        setIsLoading(true);
        setError(null);
        try {
            const result = await apiClient.getPaymentHistory({
                page,
                limit: 10,
                creator: (filters as any).creator,
                from: (filters as any).from,
                to: (filters as any).to,
            });

            if (!result.data || result.data.length === 0) {
                setData([]);
            } else {
                setData(result.data.map(mapPaymentToTransaction));
            }

            setTotalPages(result.totalPages || 1);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch transactions");
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Transaction History</h1>

            <TransactionFilters filters={filters} setFilters={setFilters} />

            <TransactionTable data={data} isLoading={isLoading} error={error} />

            <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
            />
        </div>
    );
}
