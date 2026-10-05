import { format, parseISO } from 'date-fns';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '\u20B9',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '\u00A5',
  SGD: 'S$',
  AED: 'AED ',
};

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, decimal] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${grouped}.${decimal}`;
}

export function formatDate(iso: string, pattern = 'd MMM yyyy'): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function monthKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM');
}
