import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { formatCurrency, formatDate, formatDateTime, formatNumber, LOCALE, COUNTRY, CURRENCY } from './locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
