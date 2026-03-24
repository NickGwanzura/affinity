import type { Currency } from '../types';

type MoneyCurrency = Extract<Currency, 'USD' | 'GBP'>;

export const formatCurrency = (
  amount: number,
  currency: MoneyCurrency = 'USD',
  locale = 'en-US',
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);

export const formatDate = (
  value: string | number | Date,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
): string => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, options).format(parsed);
};

export const formatMonthYear = (year: number, month: number, locale = 'en-US'): string =>
  formatDate(new Date(year, month - 1, 1), locale, { month: 'long', year: 'numeric' });

export const getMonthName = (month: number, locale = 'en-US'): string =>
  formatDate(new Date(2000, month - 1, 1), locale, { month: 'long' });
