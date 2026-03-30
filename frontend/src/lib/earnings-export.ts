import type { Transaction } from './earnings-api';

const CSV_HEADERS = ['ID', 'Date (UTC)', 'Date (Local)', 'Type', 'Description', 'Amount', 'Currency', 'Status', 'TX Hash'];

function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionsToCSV(transactions: Transaction[], timezone?: string): string {
  const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const rows = transactions.map((tx) => {
    const d = new Date(tx.date);
    const utcTimestamp = d.toISOString();
    const localTimestamp = d.toLocaleString('en-US', { timeZone: tz, hour12: false })
      .replace(',', ''); // "MM/DD/YYYY HH:MM:SS"

    return [
      tx.id,
      utcTimestamp,
      `${localTimestamp} (${tz})`,
      tx.type,
      tx.description,
      tx.amount,
      tx.currency,
      tx.status,
      tx.tx_hash ?? '',
    ].map(escapeCell).join(',');
  });

  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
