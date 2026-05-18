import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { listExpenses } from './queries';

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportExpensesCsv(): Promise<string> {
  const rows = await listExpenses({});
  const header = ['Date', 'Amount', 'Category', 'Payment Method', 'Note'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.date, r.amount, r.categoryName, r.paymentMethodName, r.note]
        .map(csvEscape)
        .join(',')
    );
  }
  const filename = `expenses-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path;
}

export async function exportExpensesJson(): Promise<string> {
  const rows = await listExpenses({});
  const filename = `expenses-${format(new Date(), 'yyyyMMdd-HHmm')}.json`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(rows, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path;
}

export async function shareFile(path: string, mime = 'text/plain') {
  const ok = await Sharing.isAvailableAsync();
  if (!ok) throw new Error('Sharing not available on this device');
  await Sharing.shareAsync(path, { mimeType: mime, dialogTitle: 'Share export' });
}
