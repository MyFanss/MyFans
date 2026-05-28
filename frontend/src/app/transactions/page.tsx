"use client";

import { useEffect, useState } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { Pagination } from "@/components/transactions/Pagination";

interface Transaction {
    id: string;
    type: "subscription" | "payment" | "refund";
    status: "pending" | "success" | "failed";
    amount: number;
    currency: string;
    txHash?: string;
    createdAt: string;
}

export default function TransactionsPage() {
    const [data, setData] = useState<Transaction[]>([]);
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchTransactions();
    }, [filters, page]);

    async function fetchTransactions() {
        const res = await fetch("/api/transactions", {
            method: "POST",
            body: JSON.stringify({ filters, page }),
        });

        const json = await res.json();
        setData(json.data);
        setTotalPages(json.totalPages);
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Transaction History</h1>

            <TransactionFilters filters={filters} setFilters={setFilters} />

            <TransactionTable data={data} />

            <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
            />
        </div>
    );
}
