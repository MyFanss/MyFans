import Link from 'next/link';
import DataTable, { ColumnDef } from '../ui/DataTable';

interface Transaction {
  id: string;
  type: 'subscription' | 'payment' | 'refund';
  status: 'pending' | 'success' | 'failed';
  amount: number;
  currency: string;
  txHash?: string;
  createdAt: string;
}

type TxKey = 'type' | 'amount' | 'status' | 'createdAt' | 'txHash';

const STATUS_CLASSES: Record<Transaction['status'], string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const COLUMNS: ColumnDef<Transaction, TxKey>[] = [
  { key: 'type', header: 'Type', sortable: true, render: (tx) => <span className="capitalize">{tx.type}</span> },
  { key: 'amount', header: 'Amount', sortable: true, render: (tx) => `${tx.amount} ${tx.currency}` },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (tx) => (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASSES[tx.status]}`}>
        {tx.status}
      </span>
    ),
  },
  { key: 'createdAt', header: 'Date', sortable: true, render: (tx) => new Date(tx.createdAt).toLocaleDateString() },
  {
    key: 'txHash',
    header: 'Tx',
    render: (tx) =>
      tx.txHash ? (
        <Link
          href={`https://stellar.expert/explorer/testnet/tx/${tx.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline"
        >
          View
        </Link>
      ) : (
        '–'
      ),
  },
];

export function TransactionTable({ data, isLoading, error }: { data: Transaction[]; isLoading?: boolean; error?: string | null }) {
  return (
    <DataTable<Transaction, TxKey>
      columns={COLUMNS}
      data={data}
      keyExtractor={(tx) => tx.id}
      isLoading={isLoading}
      error={error}
      emptyMessage="No transactions found."
      caption="Transactions"
    />
  );
}
