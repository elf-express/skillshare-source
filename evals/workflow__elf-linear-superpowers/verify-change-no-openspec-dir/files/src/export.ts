// src/export.ts — 訂單列表匯出 CSV
import { fetchOrders, type Order, type OrderFilter } from './api';

const BOM = '\uFEFF';
const COLUMNS: (keyof Order)[] = ['id', 'customer', 'status', 'amount', 'createdAt'];

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Order[]): string {
  const header = COLUMNS.join(',');
  const lines = rows.map((row) => COLUMNS.map((c) => escapeCell(row[c])).join(','));
  return BOM + [header, ...lines].join('\r\n') + '\r\n';
}

export async function collectFiltered(filter: OrderFilter): Promise<Order[]> {
  const rows: Order[] = [];
  let page = 1;
  for (;;) {
    const batch = await fetchOrders({ ...filter, page, pageSize: 1000 });
    rows.push(...batch.items);
    if (!batch.hasMore) break;
    page += 1;
  }
  return rows;
}

export async function exportOrders(filter: OrderFilter): Promise<Blob> {
  const rows = await collectFiltered(filter);
  return new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
}

export function download(blob: Blob, filename = 'orders.csv'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
