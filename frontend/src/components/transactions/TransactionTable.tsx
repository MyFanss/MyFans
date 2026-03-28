import Link from "next/link";

interface Transaction {
    id: string;
    type: "subscription" | "payment" | "refund";
    status: "pending" | "success" | "failed";
    amount: number;
    currency: string;
    txHash?: string;
    createdAt: string;
}

export function TransactionTable({ data }: { data: Transaction[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border rounded-lg">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="p-3 text-left">Type</th>
                        <th className="p-3 text-left">Amount</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Tx</th>
                    </tr>
                </thead>

                <tbody>
                    {data.map((tx) => (
                        <tr key={tx.id} className="border-t">
                            <td className="p-3 capitalize">{tx.type}</td>
                            <td className="p-3">
                                {tx.amount} {tx.currency}
                            </td>
                            <td className="p-3">
                                <span
                                    className={`px-2 py-1 rounded text-sm ${
                                        tx.status === "success"
                                            ? "bg-green-100 text-green-700"
                                            : tx.status === "pending"
                                              ? "bg-yellow-100 text-yellow-700"
                                              : "bg-red-100 text-red-700"
                                    }`}
                                >
                                    {tx.status}
                                </span>
                            </td>
                            <td className="p-3">
                                {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                                {tx.txHash ? (
                                    <Link
                                        href={`https://etherscan.io/tx/${tx.txHash}`}
                                        target="_blank"
                                        className="text-blue-600 underline"
                                    >
                                        View
                                    </Link>
                                ) : (
                                    "-"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
