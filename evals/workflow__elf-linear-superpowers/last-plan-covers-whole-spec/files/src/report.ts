// src/report.ts — 每月營收報表
import { listBranches, listOrders } from './db';
import { schedule } from './scheduler';

export interface ReportRow {
  branchId: string;
  branchName: string;
  total: number;
}

export async function buildMonthlyReport(month: string): Promise<ReportRow[]> {
  const branches = await listBranches();
  const rows: ReportRow[] = [];
  for (const b of branches) {
    const orders = await listOrders({ branchId: b.id, month, tz: b.timezone });
    const total = orders.reduce((sum, o) => sum + o.amount, 0);
    rows.push({ branchId: b.id, branchName: b.name, total });
  }
  return rows;
}

export function reportToCsv(rows: ReportRow[]): string {
  const header = 'branchId,branchName,total';
  return [header, ...rows.map((r) => `${r.branchId},${r.branchName},${r.total}`)].join('\n') + '\n';
}

export function csvFileName(month: string): string {
  return `revenue-${month}.csv`;
}

export function registerMonthlyJob(): void {
  schedule('0 6 1 * *', async () => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    await buildMonthlyReport(month);
  });
}
