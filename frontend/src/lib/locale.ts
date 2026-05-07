/**
 * Single source of truth for locale-bound formatting.
 * Switching the country = swap these constants.
 *
 * DE convention: `1.234,56 €` (currency postfix), date `dd.MM.yyyy`.
 * Intl.NumberFormat('de-DE', { style: 'currency' }) yields the correct postfix
 * automatically — no manual concatenation needed.
 */

export const LOCALE = 'de-DE';
export const COUNTRY = 'DE';
export const CURRENCY = 'EUR';

const currencyFmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
});

const numberFmt = new Intl.NumberFormat(LOCALE);

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCurrency(amount: number | string): string {
  return currencyFmt.format(Number(amount));
}

export function formatNumber(value: number | string): string {
  return numberFmt.format(Number(value));
}

export function formatDate(value: string | Date): string {
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFmt.format(new Date(value));
}
