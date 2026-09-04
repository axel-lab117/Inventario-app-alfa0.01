import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'ARS', locale = 'es-AR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, locale = 'es-AR') {
  return new Intl.NumberFormat(locale).format(num);
}

export function formatDate(date: Date | string, locale = 'es-AR', options?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: Date | string, locale = 'es-AR') {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: Date | string, locale = 'es-AR') {
  const d = typeof date === 'string' ? new Date(date) : date;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diff = d.getTime() - Date.now();
  const absDiff = Math.abs(diff);

  if (absDiff < 60_000) return rtf.format(Math.round(diff / 1000), 'second');
  if (absDiff < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (absDiff < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (absDiff < 604_800_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
  return formatDate(d, locale);
}

export function generateIdempotencyKey(...parts: string[]) {
  return parts.join(':').toLowerCase().replace(/[^a-z0-9:_-]/g, '');
}

export function parseBoxCode(code: string, patterns: string[] = []): { sku: string; sequence: string } | null {
  const defaultPatterns = [
    /^BOX-(\w+)-(\d+)$/i,
    /^(\w{8,12})-(\d{3,6})$/i,
    /^\[(\w+)\]-(\d+)$/i,
  ];

  for (const pattern of [...patterns, ...defaultPatterns]) {
    const match = code.match(pattern);
    if (match) return { sku: match[1], sequence: match[2] };
  }
  return null;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
  backoff = 2
): Promise<T> {
  return fn().catch(err => {
    if (attempts <= 1) throw err;
    return sleep(delayMs).then(() => retry(fn, attempts - 1, delayMs * backoff, backoff));
  });
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function groupBy<T>(array: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}