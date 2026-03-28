interface Filters {
    type?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
}

export function TransactionFilters({
    filters,
    setFilters,
}: {
    filters: Filters;
    setFilters: (f: Filters) => void;
}) {
    return (
        <div className="flex flex-wrap gap-4 mb-4">
            <select
                onChange={(e) =>
                    setFilters({
                        ...filters,
                        type: e.target.value || undefined,
                    })
                }
                className="border p-2 rounded"
            >
                <option value="">All Types</option>
                <option value="subscription">Subscription</option>
                <option value="payment">Payment</option>
                <option value="refund">Refund</option>
            </select>

            <select
                onChange={(e) =>
                    setFilters({
                        ...filters,
                        status: e.target.value || undefined,
                    })
                }
                className="border p-2 rounded"
            >
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
            </select>

            <input
                type="date"
                onChange={(e) =>
                    setFilters({ ...filters, fromDate: e.target.value })
                }
                className="border p-2 rounded"
            />

            <input
                type="date"
                onChange={(e) =>
                    setFilters({ ...filters, toDate: e.target.value })
                }
                className="border p-2 rounded"
            />
        </div>
    );
}
